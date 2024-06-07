import { Scene3D, Object3D, Engine3D, ColliderComponent, BoxColliderShape, Vector3 } from '@orillusion/core';

import { Ammo, Physics, Rigidbody } from '@orillusion/physics';

interface DynamicBody {
    type: string;
    name: string;
    position: Vector3;
    rotationY: number;
}

interface Cloneable {
    clone(): this;
}

interface DynamicBodyItem {
    clone: Cloneable;
    mass: number;
    size: Vector3;
}

interface DynamicBodyConfig {
    [type: string]: DynamicBodyItem;
}

export class DynamicRigidBodyManager {
    private scece: Scene3D = Engine3D.views[0].scene

    private dynamicBodyConfig: DynamicBodyConfig

    readonly dynamicRigidBodyRegion: string[] = ['0-2', '0-3', '0-4', '1-2', '1-3', '1-4', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '2-8', '2-9', '3-2', '3-3', '3-4', '3-7', '3-8', '3-9']

    constructor() {
        this.init()
    }

    async init() {
        let bodyModel = this.scece.getChildByName('dynamicBodyBase');

        let Light_one_way = bodyModel.getChildByName('Light_one_way')
        let Light_two_way = bodyModel.getChildByName('Light_two_way');
        let Small_billboards = bodyModel.getChildByName('Small_billboards')
        let Construction_signs = bodyModel.getChildByName('Construction_signs')
        let Small_Construction_signs = bodyModel.getChildByName('Small_Construction_signs')
        let Cream_cone = bodyModel.getChildByName('Cream_cone')
        let Signal_lights = bodyModel.getChildByName('Signal_lights')
        let Trashcan = bodyModel.getChildByName('Trashcan')
        let Speed_limit_sign = bodyModel.getChildByName('Speed_limit_sign')
        let Bus_signs = bodyModel.getChildByName('Bus_signs')

        bodyModel = null

        this.dynamicBodyConfig = {
            '96': { clone: Light_one_way, mass: 800, size: new Vector3(0.28, 8.5, 0.35) }, // 单路灯
            '120': { clone: Speed_limit_sign, mass: 100, size: new Vector3(0.2, 3.18, 0.4) }, // 限速牌
            '372': { clone: Signal_lights, mass: 500, size: new Vector3(0.3, 4.79, 0.4) }, // 信号灯
            '164': { clone: Light_two_way, mass: 1000, size: new Vector3(0.5, 8.5, 0.3) }, // 双路灯
            '216': { clone: Trashcan, mass: 300, size: new Vector3(1, 1.46, 0.94) }, // 垃圾桶
            '68': { clone: Small_billboards, mass: 200, size: new Vector3(0.3, 3.3, 1.62) }, // 小型广告牌
            '48': { clone: Bus_signs, mass: 100, size: new Vector3(0.3, 3.13, 0.4) }, // 公交标志牌
            '121': { clone: Cream_cone, mass: 100, size: new Vector3(0.8, 1.1, 0.6) }, // 雪糕筒
            '296': { clone: Small_Construction_signs, mass: 100, size: new Vector3(4.4, 1.59, 0.48) }, // 小型施工栏板
            '496': { clone: Construction_signs, mass: 100, size: new Vector3(3.3, 2.7, 0.48) }, // 施工栏板
        };
    }

    async createBodiesForRegionAsync(areaObject: Object3D, regionId: string): Promise<(() => void)[]> {

        if (this.dynamicRigidBodyRegion.indexOf(regionId) === -1) return [];

        const response = await fetch(`json/dynamicRigidBodyData/area_${regionId}.json`)
        const dynamicRigidBodyData = await response.json() as DynamicBody[];

        const tasks: (() => void)[] = [];

        dynamicRigidBodyData.forEach((el) => {
            const config = this.dynamicBodyConfig[el.type];
            if (!config) return [];

            tasks.push(() => {
                const obj = config.clone.clone() as Object3D;

                obj.transform.rotationY = el.rotationY;
                // obj.transform.localPosition.copy(el.position);
                obj.transform.localPosition.set(el.position.x, el.position.y + 0.2, el.position.z);

                obj.addComponent(Rigidbody).mass = config.mass;
                let collider = obj.addComponent(ColliderComponent);
                collider.shape = new BoxColliderShape();
                collider.shape.size = config.size;

                areaObject.addChild(obj);
            });

        });

        return tasks
    }

    destroyBodiesForRegionAsync(areaObject: Object3D): (() => void)[] {
        if (!areaObject) return [];

        const tasks: (() => void)[] = [];
        areaObject.forChild((node: Object3D) => {
            tasks.push(() => {
                let btRb = node.getComponent(Rigidbody);
                if (!btRb) {
                    node.destroy(true)
                    return;
                }
                
                let btRigidbody = btRb.btRigidbody as Ammo.btRigidBody;
                if (btRigidbody) {
                    Physics.world.removeRigidBody(btRigidbody);
                    const motionState = btRigidbody.getMotionState();
                    const collisionShape = btRigidbody.getCollisionShape();
                    Ammo.destroy(btRigidbody);
                    Ammo.destroy(motionState);
                    Ammo.destroy(collisionShape);
                }
                btRb.destroy();

            });
        })

        tasks.push(() => {
            areaObject.removeAllChild();
            areaObject.destroy(true);
        });

        return tasks
    }
}