import { Scene3D, Object3D, Engine3D, ColliderComponent, BoxColliderShape, Vector3, ComponentBase, KeyCode, KeyEvent, Quaternion, BoundUtil, Camera3D, Vector3Ex, MeshRenderer, LitMaterial, Color, BoxGeometry, AtmosphericComponent, CameraUtil, DirectLight, KelvinUtil, View3D, BlendMode, BitmapTexture2D, UnLitMaterial, Time, lerpVector3, Matrix4, Orientation3D } from '@orillusion/core';
import { Ammo, Physics, Rigidbody } from '@orillusion/physics';
import { RigidBodyUtil } from '@/utils/RigidBodyUtil'

enum VehicleControlType {
    acceleration,
    braking,
    left,
    right,
    handbrake
}

export class VehicleControl extends ComponentBase {
    private scene: Scene3D = Engine3D.views[0].scene
    private mBody: Object3D;
    private mWheels: Object3D[] = [];
    private mEngineForce = 0;
    private mBreakingForce = 0;
    private mVehicleSteering = 0;
    private speed: number
    private mAmmoVehicle: Ammo.btRaycastVehicle;
    private wheelInfos: Ammo.btWheelInfo[] = []
    private mVehicleControlState = [false, false, false, false]; // 车辆控制状态

    private _enableKeyEvent: boolean = true

    /**
     * 车辆配置
     */
    public mVehicleArgs = {
        wheelSize: 1,
        friction: 1000,
        suspensionStiffness: 20.0,
        suspensionDamping: 0.8,
        suspensionCompression: 0.6,
        suspensionRestLength: 0.35,
        rollInfluence: 0.15,
        steeringIncrement: 0.04,
        steeringClamp: 0.35,
        maxEngineForce: 1000,
        maxBreakingForce: 60,
        maxSuspensionTravelCm: 500
    };

    /**
     * 车轮位置偏移
     */
    public wheelPosOffset = [
        { x: 1.1, z: 1.9 },
        { x: -1.1, z: 1.9 },
        { x: 1.1, z: -1.8 },
        { x: -1.1, z: -1.8 },
    ]
    /**
     * 车轮图形对象，如果不指定则使用默认车轮
     */
    public wheel: Object3D

    async start() {

        this.mBody = this.object3D;

        this.wheel ||= await Engine3D.res.loadGltf('models/CityModel_PoliceCars_Wheel.glb');

        // 添加轮胎
        for (let index = 0; index < this.wheelPosOffset.length; index++) {
            let newWheel = this.wheel.clone()
            newWheel.scaleX = newWheel.scaleY = newWheel.scaleZ = this.mVehicleArgs.wheelSize
            this.scene.addChild(newWheel);
            this.mWheels.push(newWheel)
        }

        this.wheel = null

        this.initRaycastVehicle();

        this._enableKeyEvent && this.updateKeyboardEventListeners()

    }

    /**
     * @param enabled 启用/禁用键盘事件
     */
    public set enableKeyEvent(enabled: boolean) {
        if (this._enableKeyEvent !== enabled) {
            this._enableKeyEvent = enabled;
            this.updateKeyboardEventListeners(enabled);
        }
    }

    private updateKeyboardEventListeners(enable: boolean = true) {
        if (enable) {
            Engine3D.inputSystem.addEventListener(KeyEvent.KEY_UP, this.onKeyUp, this);
            Engine3D.inputSystem.addEventListener(KeyEvent.KEY_DOWN, this.onKeyDown, this);
        } else {
            Engine3D.inputSystem.removeEventListener(KeyEvent.KEY_UP, this.onKeyUp, this);
            Engine3D.inputSystem.removeEventListener(KeyEvent.KEY_DOWN, this.onKeyDown, this);
            this.mVehicleControlState = [false, false, false, false]
        }
    }


    private async initRaycastVehicle() {

        const bodyRb = this.mBody.data.bodyRb as Ammo.btRigidBody

        let tuning = new Ammo.btVehicleTuning();
        let rayCaster = new Ammo.btDefaultVehicleRaycaster(Physics.world);
        let vehicle = new Ammo.btRaycastVehicle(tuning, bodyRb, rayCaster);
        vehicle.setCoordinateSystem(0, 1, 2);

        this.mAmmoVehicle = vehicle;
        Physics.world.addAction(vehicle);

        let wheelDirectCS0 = new Ammo.btVector3(0, -1, 0);
        let wheelAxleCS = new Ammo.btVector3(-1, 0, 0);

        let addWheel = (isFront: boolean, x: number, y: number, z: number, radius: number) => {
            let wheelInfo = vehicle.addWheel(new Ammo.btVector3(x, y, z), wheelDirectCS0, wheelAxleCS, this.mVehicleArgs.suspensionRestLength, radius, tuning, isFront);
            wheelInfo.set_m_suspensionStiffness(this.mVehicleArgs.suspensionStiffness); // 设置悬架刚度
            wheelInfo.set_m_wheelsDampingRelaxation(this.mVehicleArgs.suspensionDamping); // 设置车轮阻尼松弛
            wheelInfo.set_m_wheelsDampingCompression(this.mVehicleArgs.suspensionCompression); // 设置车轮阻尼压缩
            wheelInfo.set_m_frictionSlip(this.mVehicleArgs.friction); // 设置摩擦滑动
            wheelInfo.set_m_rollInfluence(this.mVehicleArgs.rollInfluence); // 设置滚动影响
            wheelInfo.set_m_maxSuspensionTravelCm(this.mVehicleArgs.maxSuspensionTravelCm); // 设置悬架行程
            // wheelInfo.set_m_wheelsSuspensionForce(1000);

            this.wheelInfos.push(wheelInfo)
        };

        const r = BoundUtil.genMeshBounds(this.mWheels[0]).size.y / 2;
        const x = this.mWheels[0].transform.worldPosition.x;
        const y = -r;
        const z = this.mWheels[0].transform.worldPosition.z;


        const [w1, w2, w3, w4] = this.wheelPosOffset
        addWheel(true, (-x + w1.x), -y, (z + w1.z), r);
        addWheel(true, (x + w2.x), -y, (z + w2.z), r);
        addWheel(false, (-x + w3.x), -y, (-z + w3.z), r);
        addWheel(false, (x + w4.x), -y, (-z + w4.z), r);

        // 追加额外的车轮
        for (let index = 0; index < this.wheelPosOffset.length - 4; index++) {
            addWheel(false, (-x + this.wheelPosOffset[4 + index].x), -y, (-z + this.wheelPosOffset[4 + index].z), r);
        }
    }


    // onUpdate() {
    onLateUpdate() {

        if (!this.mAmmoVehicle) return;

        const vehicle = this.mAmmoVehicle;
        const n = vehicle.getNumWheels()

        if (this._enableKeyEvent) {
            const delta = Time.delta * 0.16
            const speed = this.speed = vehicle.getCurrentSpeedKmHour();

            this.mBreakingForce = 0;
            this.mEngineForce = 0;

            if (this.mVehicleControlState[VehicleControlType.acceleration]) {
                if (speed < -1) this.mBreakingForce = this.mVehicleArgs.maxBreakingForce;
                else this.mEngineForce = this.mVehicleArgs.maxEngineForce;
            }

            if (this.mVehicleControlState[VehicleControlType.braking]) {
                if (speed > 1) this.mBreakingForce = this.mVehicleArgs.maxBreakingForce;
                else this.mEngineForce = -this.mVehicleArgs.maxEngineForce / 2;
            }

            if (this.mVehicleControlState[VehicleControlType.left]) {
                if (this.mVehicleSteering < this.mVehicleArgs.steeringClamp) this.mVehicleSteering += delta * this.mVehicleArgs.steeringIncrement;
            } else if (this.mVehicleControlState[VehicleControlType.right]) {
                if (this.mVehicleSteering > -this.mVehicleArgs.steeringClamp) this.mVehicleSteering -= delta * this.mVehicleArgs.steeringIncrement;
            } else {

                if (this.mVehicleSteering < -this.mVehicleArgs.steeringIncrement) {
                    this.mVehicleSteering += delta * this.mVehicleArgs.steeringIncrement;
                } else {
                    // 未转向时执行
                    if (this.mVehicleSteering > this.mVehicleArgs.steeringIncrement) this.mVehicleSteering -= delta * this.mVehicleArgs.steeringIncrement;
                    else this.mVehicleSteering = 0;
                }
            }


            const FRONT_LEFT = 0;
            const FRONT_RIGHT = 1;
            const BACK_LEFT = 2;
            const BACK_RIGHT = 3;

            vehicle.applyEngineForce(this.mEngineForce, BACK_LEFT); // 动力输出
            vehicle.applyEngineForce(this.mEngineForce, BACK_RIGHT); // 动力输出
            vehicle.applyEngineForce(this.mEngineForce, FRONT_LEFT); // 动力输出
            vehicle.applyEngineForce(this.mEngineForce, FRONT_RIGHT); // 动力输出

            vehicle.setBrake(this.mBreakingForce / 2, FRONT_LEFT);
            vehicle.setBrake(this.mBreakingForce / 2, FRONT_RIGHT);
            vehicle.setBrake(this.mBreakingForce, BACK_LEFT);
            vehicle.setBrake(this.mBreakingForce, BACK_RIGHT);

            vehicle.setSteeringValue(this.mVehicleSteering, FRONT_LEFT); // 转向
            vehicle.setSteeringValue(this.mVehicleSteering, FRONT_RIGHT); // 转向  

        }

        // update body position
        let tm,
            p,
            q,
            qua = Quaternion.HELP_0;

        for (let i = 0; i < n; i++) {
            vehicle.updateWheelTransform(i, true);
            tm = vehicle.getWheelTransformWS(i);
            p = tm.getOrigin();
            q = tm.getRotation();

            this.mWheels[i].x = p.x()
            this.mWheels[i].y = p.y()
            this.mWheels[i].z = p.z()

            qua.set(q.x(), q.y(), q.z(), q.w());
            this.mWheels[i].transform.localRotQuat = qua;
        }

        vehicle.getRigidBody().getMotionState().getWorldTransform(Physics.TEMP_TRANSFORM);
        p = Physics.TEMP_TRANSFORM.getOrigin();
        this.mBody.x = p.x();
        this.mBody.y = p.y();
        this.mBody.z = p.z();
        q = Physics.TEMP_TRANSFORM.getRotation();
        qua.set(q.x(), q.y(), q.z(), q.w());
        this.mBody.transform.localRotQuat = qua;

        // 重置
        if (this.mBody.y < -30) {
            RigidBodyUtil.resetRigidBody(vehicle.getRigidBody(), new Vector3(0, 50, 0), Quaternion._zero)
        }

    }

    onKeyUp(e: KeyEvent) {
        this.updateControlState(e.keyCode, false);
    }
    onKeyDown(e: KeyEvent) {
        this.updateControlState(e.keyCode, true);
    }
    updateControlState(keyCode: number, state: boolean) {
        switch (keyCode) {
            case KeyCode.Key_W:
                this.mVehicleControlState[VehicleControlType.acceleration] = state;
                break;
            case KeyCode.Key_Up:
                this.mVehicleControlState[VehicleControlType.acceleration] = state;
                break;
            case KeyCode.Key_S:
                this.mVehicleControlState[VehicleControlType.braking] = state;
                break;
            case KeyCode.Key_Down:
                this.mVehicleControlState[VehicleControlType.braking] = state;
                break;
            case KeyCode.Key_A:
                this.mVehicleControlState[VehicleControlType.left] = state;
                break;
            case KeyCode.Key_Left:
                this.mVehicleControlState[VehicleControlType.left] = state;
                break;
            case KeyCode.Key_D:
                this.mVehicleControlState[VehicleControlType.right] = state;
                break;
            case KeyCode.Key_Right:
                this.mVehicleControlState[VehicleControlType.right] = state;
                break;
            case KeyCode.Key_Space:
                this.mVehicleControlState[VehicleControlType.handbrake] = state;
                break;
        }
    }

    /**
     * Gets the vehicle speed per hour
     */
    public get vehicleSpeed(): number {
        return this.speed;
    }

    public destroy(force?: boolean) {
        Engine3D.inputSystem.removeEventListener(KeyEvent.KEY_UP, this.onKeyUp, this);
        Engine3D.inputSystem.removeEventListener(KeyEvent.KEY_DOWN, this.onKeyDown, this);
        RigidBodyUtil.destroyRigidBody(this.mBody);
        this.mBody = null;

        this.mWheels.forEach(e => e.destroy());
        this.mWheels = null;

        Physics.world.removeAction(this.mAmmoVehicle);
        Ammo.destroy(this.mAmmoVehicle);

        this.wheelInfos = null;
        this.mVehicleArgs = null;

        if (this.wheel) this.wheel.destroy();
        super.destroy(force);
    }
}
