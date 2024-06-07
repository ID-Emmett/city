
import { Scene3D, Object3D, Engine3D, Vector3, ComponentBase, Time } from '@orillusion/core';
import { DynamicRigidBodyManager, StaticRigidBodyManager } from '@/components/rigidBodyManage'


interface Area {
    x: number,
    z: number,
    row: number,
    col: number,
    loaded: boolean
}

export class City_RegionManage extends ComponentBase {

    // 目标实体容器，通常内部包含玩家实体，作为容器使用，同步新的玩家实体给AI车辆实例
    private playerInfo: { playerObjdect3D: Object3D } = null

    private scene: Scene3D = Engine3D.views[0].scene

    // 玩家当前所在区域
    private playerArea: string

    readonly areaWidth: number = 200
    readonly areaHeight: number = 200

    private timeInterval: number = 0

    private regions: Map<string, Area> = new Map<string, Area>();

    // 用于分帧处理的区域任务队列
    private regionQueues: Map<string, Array<() => void>> = new Map<string, Array<() => void>>();

    private dynamicRigidBody: DynamicRigidBodyManager
    private staticRigidBody: StaticRigidBodyManager

    public async start() {

        this.initializeAreas()

        this.dynamicRigidBody = new DynamicRigidBodyManager()
        this.staticRigidBody = new StaticRigidBodyManager()

        // 必须为scene提前绑定数据 > scene.data.playerInfo.playerObjdect3D 
        this.playerInfo = this.object3D.data.playerInfo
        this.playerInfo.playerObjdect3D.data ||= {}

    }

    private initializeAreas() {

        // 初始化区域
        const rows = 5;
        const cols = 10;

        const regions = this.regions;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                let x = (row - 2) * this.areaWidth;
                let z = (col - 4) * this.areaHeight;
                const areaCodeRow = Math.floor((x + this.areaWidth / 2) / this.areaWidth) + 2;
                const areaCodeCol = Math.floor((z + this.areaHeight / 2) / this.areaHeight) + 4;

                let key = `${areaCodeRow}-${areaCodeCol}`;
                regions.set(key, { x, z, loaded: false, row: areaCodeRow, col: areaCodeCol })
            }
        }

    }


    public async onUpdate() {

        if (!this.enable) return
        if (Time.time > this.timeInterval) {
            
            const targetEntity = this.playerInfo.playerObjdect3D
            this.checkAreas(targetEntity);
            this.timeInterval = Time.time + 500
        }

        this.processRegionQueues();

    }
    private processRegionQueues() {
        // this.regionQueues.forEach((queue) => {
        //   if (queue.length > 0) queue.shift()?.();
        // });

        if (this.regionQueues.size === 0) return

        const maxTasksPerFrame = 30; // 每帧处理的最大任务数

        this.regionQueues.forEach((queue) => {
            for (let i = 0; i < maxTasksPerFrame && queue.length > 0; i++) queue.shift()?.();
        });

    }

    private async checkAreas(targetEntity: Object3D) {
        const { x, z } = targetEntity
        const w = this.areaWidth
        const h = this.areaHeight
        const threshold = 50; // 触发区域加载或卸载的阈值

        // 计算玩家当前所在区域的索引
        const playerAreaRow = Math.floor((x + w / 2) / w) + 2;
        const playerAreaCol = Math.floor((z + h / 2) / h) + 4;

        this.playerArea = `${playerAreaRow}-${playerAreaCol}`;

        // console.log(this.playerArea);

        // 需要检查的区域集合
        const areasToCheck = new Set<string>();

        // 检查玩家是否靠近区域的边缘
        const isNearTopEdge = z > (playerAreaCol - 4) * h + h / 2 - threshold;
        const isNearBottomEdge = z < (playerAreaCol - 4) * h - h / 2 + threshold;
        const isNearLeftEdge = x > (playerAreaRow - 2) * w + w / 2 - threshold;
        const isNearRightEdge = x < (playerAreaRow - 2) * w - w / 2 + threshold;

        // 根据边缘检测结果添加相邻区域
        if (isNearTopEdge) areasToCheck.add(`${playerAreaRow}-${playerAreaCol + 1}`);
        if (isNearBottomEdge) areasToCheck.add(`${playerAreaRow}-${playerAreaCol - 1}`);
        if (isNearLeftEdge) areasToCheck.add(`${playerAreaRow + 1}-${playerAreaCol}`);
        if (isNearRightEdge) areasToCheck.add(`${playerAreaRow - 1}-${playerAreaCol}`);

        // 只处理需要检查的区域
        areasToCheck.add(this.playerArea);
        areasToCheck.forEach(key => {
            const area = this.regions.get(key);
            if (area && !area.loaded) {
                // this.loadArea(area);
                const queue = this.regionQueues.get(key) || [];
                queue.push(() => this.loadArea(area, key));
                this.regionQueues.set(key, queue)
            }
        });

        // 卸载不在检查集合中的已加载区域
        this.regions.forEach((area, key) => {
            if (!areasToCheck.has(key) && area.loaded) {
                // this.unloadArea(area);
                const queue = this.regionQueues.get(key) || [];
                queue.length = 0
                queue.push(() => this.unloadArea(area, key));
                this.regionQueues.set(key, queue)
            }
        });


        // 玩家靠近边界时，不加载边界相邻区域的AI车辆
        // if (areasToCheck.size > 0) targetEntity.data.excludedAreas = [...areasToCheck]

        // 玩家切换区域时更新相邻区域，包括上, 下, 左, 右 和对角线
        // if (targetEntity.data?.playerArea !== this.playerArea) {
        //     targetEntity.data.playerArea = this.playerArea
        //     targetEntity.data.nearAreas = this.findAdjacent(playerAreaRow, playerAreaCol)

        // }
    }

    // 寻找相邻的区域
    private findAdjacent(row: number, col: number): string[] {
        // 定义可能的方向: 上, 下, 左, 右 和对角线
        const directions: [number, number][] = [
            [-1, 0], [1, 0], [0, -1], [0, 1],
            [-1, -1], [-1, 1], [1, -1], [1, 1]
        ];

        // 生成所有相邻单元格的位置
        const adjacentCells: string[] = directions.map(([r, c]) => `${row + r}-${col + c}`);

        return adjacentCells;
    }

    private loadArea(area: Area, key: string) {
        area.loaded = true;
        // console.log(`加载区域: ${area.x},${area.z},    ${key}`);
        this.createRigidbody(area.x, area.z, key)
    }

    private unloadArea(area: Area, key: string) {
        area.loaded = false;
        // console.log(`卸载区域: ${area.x},${area.z},   ${key}`);
        this.uninstallRigidbody(key)
    }

    async createRigidbody(x: number, z: number, key: string) {

        let areaObject = new Object3D();

        let queue = this.regionQueues.get(key)


        // 区域初始化
        queue.push(async () => {

            areaObject.name = `physicalArea_${key}`

            this.scene.addChild(areaObject);

        })

        // 添加静态刚体
        let staticRbTasks = await this.staticRigidBody.createBodiesForRegionAsync(key)

        // 添加动态刚体
        let dynamicRbTasks = await this.dynamicRigidBody.createBodiesForRegionAsync(areaObject, key)

        dynamicRbTasks.push(() => {
            let streetLightBlock = this.scene.getChildByName(`DynamicRigidBodyGroup_${key}`) as Object3D;
            if (streetLightBlock) streetLightBlock.y = -500;
        })

        queue.push(...staticRbTasks, ...dynamicRbTasks);

        queue.push(() => this.regionQueues.delete(key))

    }


    async uninstallRigidbody(key: string) {

        let queue = this.regionQueues.get(key)

        // 加载该区路灯块
        let streetLightBlock = this.scene.getChildByName(`DynamicRigidBodyGroup_${key}`) as Object3D
        if (streetLightBlock) streetLightBlock.y = 0;

        // 销毁动态刚体
        const areaObject = this.scene.getChildByName(`physicalArea_${key}`) as Object3D
        let dynamicRbTasks = this.dynamicRigidBody.destroyBodiesForRegionAsync(areaObject)

        // 销毁静态刚体
        let staticRbTasks = this.staticRigidBody.destroyBodiesForRegionAsync(key)

        queue.push(...dynamicRbTasks, ...staticRbTasks);

        queue.push(() => this.regionQueues.delete(key))
    }

}
