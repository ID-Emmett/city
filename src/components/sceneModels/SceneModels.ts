import { Scene3D, Object3D, Engine3D, Vector3, ComponentBase, Quaternion, HoverCameraController } from '@orillusion/core';
import { VehicleControl } from '@/components/keyboardController'
import { City_RegionManage } from '@/components/spaceZoning/CityRegionManage';
import { AI_CarsManage } from '@/components/aiCarsManage/index';
import { RigidBodyUtil } from '@/utils/RigidBodyUtil'
import { Water } from './Water';

export class SceneModels extends ComponentBase {

    private scene: Scene3D;

    public hoverCamera: HoverCameraController

    private vehicle: Object3D;

    public gui: any
    public async start() {

        this.scene = this.transform.scene3D;
        this.vehicle = new Object3D()

        let glftModel = await Engine3D.res.loadGltf('models/City_Model.glb'); // cityModel
        glftModel.name = 'cityModel'
        this.object3D.addChild(glftModel);

        let dynamicBodyBase = await Engine3D.res.loadGltf('models/DynamicBodyBase.glb'); // 动态刚体模型
        dynamicBodyBase.name = 'dynamicBodyBase'
        dynamicBodyBase.y = -100
        this.scene.addChild(dynamicBodyBase);

        // 水面
        this.scene.addComponent(Water);

        this.scene.data = { playerInfo: { playerObjdect3D: this.vehicle } }

        // 空间区域管理
        this.scene.addComponent(City_RegionManage);

        // AI车辆
        let aiCarsManage = this.scene.addComponent(AI_CarsManage)
        aiCarsManage.carCount = 100; // 100辆车

        this.initGui(aiCarsManage)
    }

    private initGui(aiCarsManage: AI_CarsManage) {

        let f = this.gui.addFolder('City');
        f.add(Engine3D, 'frameRate', 10, 170, 10);
        f.add(aiCarsManage, 'carCount', 0, 300, 1);
        f.add({ reset: () => location.reload() }, 'reset');
        f.add({
            resetVehicle: () => {
                if (this.vehicle.transform.isDestroyed) return;
                let { x, y, z } = this.vehicle.localPosition;
                let bodyRb = this.vehicle.data.bodyRb;
                if (!bodyRb) return;
                RigidBodyUtil.resetRigidBody(bodyRb, new Vector3(x, 50, z), Quaternion._zero);

                this.hoverCamera.flowTarget(this.vehicle);
            }
        }, 'resetVehicle');

        let originObj = new Object3D()
        let vehicleEnable = { vehicle: false }
        f.add(vehicleEnable, 'vehicle').onChange(async (v: boolean) => {
            if (v) {
                this.createVehicle()
            } else {
                this.hoverCamera.flowTarget(null)
                this.scene.data.playerInfo.playerObjdect3D = originObj;
                this.vehicle?.destroy()
            }

        });
        f.open();
    }

    private async createVehicle() {
        let carModel = await Engine3D.res.loadGltf('models/Car_RedPickup_Chassis.glb');
        let vehicle = carModel.clone()
        vehicle.name = 'RedPickup'
        vehicle.y = 1;
        vehicle.scaleX = vehicle.scaleY = vehicle.scaleZ = 1

        const response = await fetch(`json/compoundRigidBodyData/redPickupData.json`)
        const redPickupData = await response.json();

        // 创建刚体
        await RigidBodyUtil.createAndAddRigidBody(vehicle, 300, 0.1, 0.1, redPickupData, 4)

        // add keyboard controller to the car
        let vehicleControl = vehicle.addComponent(VehicleControl);

        vehicleControl.mVehicleArgs = {
            wheelSize: 1,
            friction: 1000, // 摩擦力 1000 值越大越滑
            suspensionStiffness: 15.0, // 悬架刚度 20.0
            suspensionDamping: 1, // 悬架阻尼 2.3
            suspensionCompression: 1, // 悬架压缩 4.4
            suspensionRestLength: 0.7, // 悬吊长度 0.6
            rollInfluence: 0.3, // 离心力 影响力 0.2
            steeringIncrement: 0.005,  // 转向增量 0.04
            steeringClamp: 0.32, // 转向钳 0.5
            maxEngineForce: 300, // 最大发动机力 1500
            maxBreakingForce: 30, // 最大断裂力 500
            maxSuspensionTravelCm: 500 // 最大悬架行程
        }
        // 车轮位置偏移
        vehicleControl.wheelPosOffset = [
            { x: 1.1, z: 1.9 },
            { x: -1.1, z: 1.9 },
            { x: 1.1, z: -1.8 },
            { x: -1.1, z: -1.8 },
        ]

        this.scene.data.playerInfo.playerObjdect3D = vehicle

        this.scene.addChild(vehicle)
        this.hoverCamera.distance = 50
        this.hoverCamera.roll = 180
        this.hoverCamera.pitch = -30
        this.hoverCamera.flowTarget(vehicle)
        this.vehicle.destroy()
        this.vehicle = vehicle
    }

}
