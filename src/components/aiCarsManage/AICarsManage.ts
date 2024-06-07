import { Scene3D, Object3D, Engine3D, Transform, LitMaterial, ColliderComponent, BoxColliderShape, Vector3, MeshRenderer, ComponentBase, Color, Time, Texture, BoundUtil, Quaternion } from '@orillusion/core';

import { AI_Car } from '@/components/aiCarsManage/index'

type PathPoint = {
    areaId: string,
    name: string,
    x: number,
    y: number,
    z: number,
    directions: AxisDirection[], // 每个点可能的轴向方向
};

type Road = {
    axisValue: number, // X或Z轴的值
    pathPoints: PathPoint[], // 此道路上的所有路径点
};

// 方向定义
type AxisDirection = 'PosX' | 'NegX' | 'PosZ' | 'NegZ';

interface TruckConfig {
    texture: null | string;
    goods: {
        [key: string]: null | string;
    };
}

export class AI_CarsManage extends ComponentBase {

    // 目标实体容器，通常内部包含玩家实体，作为容器使用，同步新的玩家实体给AI车辆实例

    private scene: Scene3D = Engine3D.views[0].scene

    // 存储X轴与Z轴道路的哈希表，X轴数据相等则为同一Z轴道路  xRoads 纵轴道路  zRoads横轴道路
    public xRoads: Map<number, Road> = new Map();
    public zRoads: Map<number, Road> = new Map();
    public pathPointAreas: Map<string, PathPoint[]> = new Map()

    private carModels: Object3D[] = []
    private truckResource: { [key in string]: Object3D | Texture } = {}
    private aiCars: Object3D[] = []
    private _carCount: number = 100;
    public get carCount() {
        return this._carCount
    }
    public set carCount(value: number) {
        if (value === this.carCount) return;
        if (value > this.carCount) {
            this.createCars(value - this.carCount);
        } else {
            let n = this.carCount - value;
            let removeCars = this.aiCars.splice(-n, n);
            removeCars.forEach(e => e.destroy())
        }

        this._carCount = value
        // console.log('AI Car Count:', this.aiCars.length);
    }

    async start() {

        await this.initPathPoint()

        await this.initResource()

        this.createCars(this.carCount)

    }

    private async initResource() {

        // 车辆模型
        let carModels: Object3D[] = []
        this.carModels = carModels;
        carModels.push(await Engine3D.res.loadGltf('models/Car_RedTruck.glb')); // 红色卡车
        carModels.push(await Engine3D.res.loadGltf('models/Car_PoliceCars.glb'));
        carModels.push(await Engine3D.res.loadGltf('models/Car_FireTruck.glb'));
        carModels.push(await Engine3D.res.loadGltf('models/Car_Taxi.glb'));
        carModels.push(await Engine3D.res.loadGltf('models/Car_BluePickup.glb'));
        carModels.push(await Engine3D.res.loadGltf('models/Car_RedPickup.glb'));
        carModels.push(await Engine3D.res.loadGltf('models/Car_GrayPickup.glb'));
        carModels.push(await Engine3D.res.loadGltf('models/Car_Blue.glb'));
        carModels.push(await Engine3D.res.loadGltf('models/Car_BlueBus.glb'));
        carModels.push(await Engine3D.res.loadGltf('models/Car_YellowSchoolBus.glb'));
        carModels.push(await Engine3D.res.loadGltf('models/Car_Ambulance.glb'));


        // 货物：红色集装箱-油罐-原木
        let Goods_RedBox = await Engine3D.res.loadGltf('models/Goods_RedBox.glb')
        let Goods_Tank = await Engine3D.res.loadGltf('models/Goods_Tank.glb')
        let Goods_Wood = await Engine3D.res.loadGltf('models/Goods_Wood.glb')

        // 卡车与货物材质
        let Goods_BlueBox_Texture = await Engine3D.res.loadTexture('texture/Goods_BlueBox_Texture.png');
        let Goods_GreenBox_Texture = await Engine3D.res.loadTexture('texture/Goods_GreenBox_Texture.png');
        let Car_BlueTruck_Texture = await Engine3D.res.loadTexture('texture/Car_BlueTruck_Texture.png');
        let Car_GreenTruck_Texture = await Engine3D.res.loadTexture('texture/Car_GreenTruck_Texture.png');

        this.truckResource = {
            Goods_RedBox,
            Goods_Tank,
            Goods_Wood,
            Goods_BlueBox_Texture,
            Goods_GreenBox_Texture,
            Car_BlueTruck_Texture,
            Car_GreenTruck_Texture
        }
    }

    private createCars(carCount: number) {
        const truckConfig: TruckConfig[] = [
            {
                texture: null,
                goods: {
                    'NotGoods': null,
                    'Goods_RedBox': null,
                    'Goods_Wood': null,
                    'Goods_Tank': null
                }
            },
            {
                texture: 'Car_BlueTruck_Texture',
                goods: {
                    'NotGoods': null,
                    'Goods_RedBox': 'Goods_BlueBox_Texture',
                    'Goods_Wood': null,
                }
            },
            {
                texture: 'Car_GreenTruck_Texture',
                goods: {
                    'NotGoods': null,
                    'Goods_RedBox': 'Goods_GreenBox_Texture',
                    'Goods_Wood': null,
                }
            }
        ]

        for (let i = 0; i < carCount; i++) { // 创建车辆

            const randomIdx = Math.floor(Math.random() * this.carModels.length)
            let cloneCar = this.carModels[randomIdx].clone()

            if (randomIdx === 0) { // 卡车
                let truck = truckConfig[Math.floor(Math.random() * truckConfig.length)] // 选则卡车颜色
                if (truck.texture) this.changeMaterial(cloneCar, this.truckResource[truck.texture] as Texture)

                let goodsType = Object.keys(truck.goods)[Math.floor(Math.random() * Object.keys(truck.goods).length)] // 选择卡车货物
                if (goodsType !== 'NotGoods') {
                    const goods = (this.truckResource[goodsType] as Object3D).clone();
                    goods.transform.localPosition = new Vector3(0, 3, -2.2)
                    goods.transform.localRotation = Vector3.ZERO
                    if (truck.goods[goodsType]) this.changeMaterial(goods, this.truckResource[truck.goods[goodsType]] as Texture)
                    cloneCar.addChild(goods)
                }
            }


            // 随机选取 道路、路径点、方向
            const xRoadsValues: Road[] = [...this.xRoads.values()]
            let road: Road = xRoadsValues[Math.floor(Math.random() * xRoadsValues.length)]
            let initialPathPoint: PathPoint = road.pathPoints[Math.floor(Math.random() * road.pathPoints.length)]
            let initialDirection: AxisDirection = initialPathPoint.directions[Math.floor(Math.random() * initialPathPoint.directions.length)];

            let aiCar = cloneCar.addComponent(AI_Car)
            aiCar.currentPathPoint = initialPathPoint
            aiCar.currentDirection = initialDirection
            aiCar.xRoads = this.xRoads
            aiCar.zRoads = this.zRoads
            aiCar.pathPointAreas = this.pathPointAreas

            this.scene.addChild(cloneCar);
            this.aiCars.push(cloneCar)
        }
    }

    private changeMaterial(object: Object3D, texture: Texture) {
        object.forChild((node: Object3D) => {
            if (node.hasComponent(MeshRenderer)) {
                let mr = node.getComponent(MeshRenderer);
                let mat = new LitMaterial()
                mat.metallic = 0
                mat.roughness = 10
                mat.baseMap = texture
                // mat.baseColor = new Color(Color.NAVY)
                // mat.baseColor = new Color(Color.SALMON)
                // mat.transparent = true
                mr.material = mat
            }
        });
    }


    private async initPathPoint() {

        const response = await fetch(`json/roadNetData/roadNetData.json`)
        const data = await response.json() as PathPoint[];

        data.forEach(point => {

            // 根据坐标轴分类
            this.addPathPointToRoads(point)

            // 根据区域id分类
            let area = this.pathPointAreas.get(point.areaId)
            if (!area) this.pathPointAreas.set(point.areaId, [point])
            else area.push(point)
        });
    }

    private addPathPointToRoads(pathPoint: PathPoint) {
        // 该点属于哪条道路（x轴或z轴）

        // 添加到x轴道路
        let xRoad = this.xRoads.get(pathPoint.x);
        if (!xRoad) {
            xRoad = { axisValue: pathPoint.x, pathPoints: [] };
            this.xRoads.set(pathPoint.x, xRoad);
        }
        xRoad.pathPoints.push(pathPoint);
        xRoad.pathPoints.sort((a, b) => a.z - b.z);

        // 添加到z轴道路
        let zRoad = this.zRoads.get(pathPoint.z);
        if (!zRoad) {
            zRoad = { axisValue: pathPoint.z, pathPoints: [] };
            this.zRoads.set(pathPoint.z, zRoad);
        }
        zRoad.pathPoints.push(pathPoint);
        zRoad.pathPoints.sort((a, b) => a.x - b.x);

    }

}
