import { Scene3D, Object3D, Engine3D, Transform, LitMaterial, ColliderComponent, BoxColliderShape, Vector3, MeshRenderer, ComponentBase, Color, Time, Texture, BoundUtil, Quaternion, SphereGeometry } from '@orillusion/core';

type PathPoint = {
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

interface NextDeltaMap {
    [key: string]: {
        PosZ?: number;
        NegZ?: number;
        PosX?: number;
        NegX?: number;
    };
}

export class AI_Car extends ComponentBase {
    public car: Object3D;
    public currentPathPoint: PathPoint;
    public currentDirection: AxisDirection;
    public nextPathPoint: PathPoint;
    public nextDirection: AxisDirection;

    private speed: number = 1
    private isTurning: boolean = true;
    private diffX: number = 0
    private diffZ: number = 0

    public xRoads: Map<number, Road> = new Map();
    public zRoads: Map<number, Road> = new Map();
    public pathPointAreas: Map<string, PathPoint[]> = new Map()

    private readonly radToDeg: number = 180 / Math.PI; // 缓存弧度到角度的转换

    public start() {
        this.car = this.object3D
        this.getNextPathPoint(this.currentPathPoint, this.currentDirection, this.xRoads, this.zRoads)

        // 设置AI车辆位置
        this.car.x = this.diffX
        this.car.y = this.currentPathPoint.y
        this.car.z = this.diffZ
        const rotationMatch: { [key in AxisDirection]: number } = {
            'PosX': 90,
            'NegX': -90,
            'PosZ': 0,
            'NegZ': 180
        }
        this.car.rotationY = rotationMatch[this.currentDirection]
    }

    private updateRotation(transform: Transform, dx: number, dz: number, deltaTime: number) {

        if (this.isTurning) {

            // 上下坡倾斜

            const currentY = this.currentPathPoint.y

            if (currentY) { // 当前路径点高度不为0时
                const nextY = this.nextPathPoint.y

                transform.y += transform.forward.y * this.speed * deltaTime;

                if (currentY === 15.1 && nextY === 15) {
                    // 开始上坡
                    let diff = (-14 - transform.rotationX + 540) % 360 - 180;
                    if (Math.abs(diff) < 0.2) {
                        transform.rotationX = -14;
                    } else {
                        transform.rotationX += diff * deltaTime * 0.5;
                    }
                } else if (currentY === 0.2 && nextY === 0.1) {
                    // 开始下坡
                    let diff = (14 - transform.rotationX + 540) % 360 - 180;
                    if (Math.abs(diff) < 0.2) {
                        transform.rotationX = 14;
                    } else {
                        transform.rotationX += diff * deltaTime * 0.5;
                    }
                } else {
                    // 回正
                    let diff = (0 - transform.rotationX + 540) % 360 - 180;
                    if (Math.abs(diff) < 0.2) {
                        transform.rotationX = 0;
                        if (transform.y !== 0) {
                            if (transform.y < 5) transform.y = 0
                            else if (transform.y > 14.5) transform.y = 15
                        }
                    } else {
                        transform.rotationX += diff * deltaTime * 0.4;
                    }
                }

            }

            const targetRotation = Math.atan2(dx, dz) * this.radToDeg;
            let diff = (targetRotation - transform.rotationY + 540) % 360 - 180;
            let rotationY
            if (Math.abs(diff) < 0.5) {
                if (transform.rotationX === 0) {
                    this.isTurning = false;
                }
                rotationY = targetRotation;
            } else {
                rotationY = (transform.rotationY % 360) + (diff * deltaTime * 0.15);
            }

            transform.rotationY = rotationY

            // 供刚体转向使用
            this.car.data = { dx, dz }
        }
    }

    private updateMovement(transform: Transform, deltaTime: number) {
        const moveDistance = this.speed * deltaTime;
        transform.x += transform.forward.x * moveDistance;
        transform.z += transform.forward.z * moveDistance;
    }

    public updatePosition(deltaTime: number, xRoads: Map<number, Road>, zRoads: Map<number, Road>) {

        if (!this.car || !this.currentPathPoint) {
            // console.log('无路径 或停止控制');
            return
        }

        let transform = this.car.transform;

        const dx = this.diffX - transform.x;
        const dz = this.diffZ - transform.z;

        this.updateRotation(transform, dx, dz, deltaTime);
        this.updateMovement(transform, deltaTime);


        const remainingDistanceSquared = dx * dx + dz * dz;
        const thresholdSquared = (this.speed * deltaTime) * (this.speed * deltaTime);

        // 当车辆位置距离当前路径点一定范围内时（5）切换至下一个路径点，确保上下坡和转向自然
        if (remainingDistanceSquared < thresholdSquared + 5) {

            // 更新路径点，使用已缓存的下一路径作为当前路径，并继续缓存下一个路径点

            this.currentPathPoint = this.nextPathPoint
            this.currentDirection = this.nextDirection
            this.isTurning = true; // 重置转向状态

            // 缓存下一个路径点与方向
            this.getNextPathPoint(this.currentPathPoint, this.currentDirection, xRoads, zRoads);
        }
    }

    private getNextPathPoint(pathPoint: PathPoint, direction: AxisDirection, xRoads: Map<number, Road>, zRoads: Map<number, Road>) {

        let nextPathPoint: PathPoint | null = null
        let nextDirection: AxisDirection

        // 先选择方向，再选择路径点 定义每个方向的相反方向
        const oppositeDirection: { [key in AxisDirection]: AxisDirection } = {
            'PosX': 'NegX',
            'NegX': 'PosX',
            'PosZ': 'NegZ',
            'NegZ': 'PosZ'
        };
        let negDirection = oppositeDirection[direction]
        let availableDirections = pathPoint.directions.filter(d => d !== negDirection)

        nextDirection = availableDirections[Math.floor(Math.random() * availableDirections.length)]

        // console.log('下个方向', nextDirection);

        let road = (nextDirection === 'PosX' || nextDirection === 'NegX') ? zRoads.get(pathPoint.z) : xRoads.get(pathPoint.x);

        if (!road || !road.pathPoints.length) {
            console.error("No road found or no path points available");
        }

        // 基于当前方向筛选符合条件的路径点
        let filteredPoints = this.filterForwardPoints(road.pathPoints, pathPoint, nextDirection);
        if (filteredPoints.length === 0) {
            console.error("No forward path points found");

            console.log('无路径点的方向', nextDirection);

            // 未找到该方向对应的路径点，重新选取方向

            let availableDirections = pathPoint.directions.filter(d => (d !== negDirection && d !== nextDirection))
            console.log(availableDirections);

            nextDirection = availableDirections[Math.floor(Math.random() * availableDirections.length)]

            let road = (nextDirection === 'PosX' || nextDirection === 'NegX') ? zRoads.get(pathPoint.z) : xRoads.get(pathPoint.x);

            console.log(road.pathPoints, pathPoint, nextDirection);

            filteredPoints = this.filterForwardPoints(road.pathPoints, pathPoint, nextDirection);

            console.log(filteredPoints);

            if (filteredPoints.length === 0) {
                console.log('最终选择');
                nextDirection = pathPoint.directions[0]
                let road = (nextDirection === 'PosX' || nextDirection === 'NegX') ? zRoads.get(pathPoint.z) : xRoads.get(pathPoint.x);
                filteredPoints = this.filterForwardPoints(road.pathPoints, pathPoint, nextDirection);
            }

            console.log('重新选取的新方向', nextDirection);

        }

        // 随机选择一个路径点
        // nextPathPoint = filteredPoints[Math.floor(Math.random() * filteredPoints.length)];

        // 选取最近的路径点
        if (nextDirection === 'PosX' || nextDirection === 'PosZ') {
            nextPathPoint = filteredPoints[0];
        } else {
            nextPathPoint = filteredPoints[filteredPoints.length - 1];
        }

        this.turningPosition(pathPoint, direction, nextDirection)

        this.nextDirection = nextDirection
        this.nextPathPoint = nextPathPoint
    }

    private filterForwardPoints(pathPoints: PathPoint[], currentPoint: PathPoint, direction: AxisDirection): PathPoint[] {
        return pathPoints.filter(p => {
            if (direction === 'PosX') return p.x > currentPoint.x;
            else if (direction === 'NegX') return p.x < currentPoint.x;
            else if (direction === 'PosZ') return p.z > currentPoint.z;
            else if (direction === 'NegZ') return p.z < currentPoint.z;
            else false;
        });
    }

    private turningPosition(pathPoint: PathPoint, direction: AxisDirection, nextDirection: AxisDirection): void {
        const delta: { [key in AxisDirection]: number } = { 'PosX': 3.5, 'NegX': -3.5, 'PosZ': -3.5, 'NegZ': 3.5 };
        const nextDelta: NextDeltaMap = {
            'PosX': { 'PosZ': -10, 'NegZ': -3 },
            'NegX': { 'PosZ': 3, 'NegZ': 10 },
            'PosZ': { 'PosX': -3, 'NegX': -10 },
            'NegZ': { 'PosX': 10, 'NegX': 3 },
        };

        // Making sure the nextDelta for the direction exists and contains the nextDirection
        const directionAdjustments = nextDelta[direction];
        const nextDirectionDelta = directionAdjustments && directionAdjustments[nextDirection];

        if (direction === 'PosX' || direction === 'NegX') {
            this.diffZ = pathPoint.z + delta[direction];
            this.diffX = pathPoint.x + (nextDirectionDelta ?? 0);
        } else {
            this.diffX = pathPoint.x + delta[direction];
            this.diffZ = pathPoint.z + (nextDirectionDelta ?? 0);
        }
    }

    public onUpdate() {
        this.updatePosition(Time.delta * 0.016, this.xRoads, this.zRoads)
    }

}
