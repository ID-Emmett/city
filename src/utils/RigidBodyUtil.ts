import { Object3D, BoundUtil, Vector3, Quaternion, Object3DUtil } from '@orillusion/core';

import { Ammo, Physics } from '@orillusion/physics';


type RigidBodyData = {
    type?: string;
    position: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number, w: number };
    size: { width: number; height: number; depth: number };
};

type ShapeType = 'Box' | 'Cylinder';


export class RigidBodyUtil {

    /**
     * Create rigid body And add it to the physics world
     * @param mBody Graphic Object
     * @param bodyMass The total mass of the rigid body
     * @param linDamping Linear damping Values range from 0 to 1
     * @param angDamping Angle damping Values range from 0 to 1
     * @param compoundShapeData Data required for compound rigid body, Creates a bounding box shape when the value is null
     * @param activationState ACTIVE_TAG (1)、ISLAND_SLEEPING (2)、WANTS_DEACTIVATION (3)、DISABLE_DEACTIVATION (4)
     * @param shapeType Box and Cylinder default Box
     */
    public static async createAndAddRigidBody(
        mBody: Object3D,
        bodyMass: number = 1,
        linDamping: number = 0,
        angDamping: number = 0,
        compoundShapeData: RigidBodyData[] = null,
        activationState: number = 1,
        shapeType: ShapeType = 'Box',
    ): Promise<Ammo.btRigidBody> {

        let bodyRb = compoundShapeData ?
            await this.createCompoundRigidBody(mBody, bodyMass, compoundShapeData) :
            await this.createMeshBoundsRigidBody(mBody, bodyMass, shapeType)

        bodyRb.setDamping(linDamping, angDamping);

        bodyRb.setActivationState(activationState);

        /*
          ACTIVE_TAG (1)： 默认状态，物体会根据动力学和碰撞来激活和休眠。
          ISLAND_SLEEPING (2)： 物体处于休眠状态，但可能会被其他移动的物体唤醒。
          WANTS_DEACTIVATION (3)： 物体没有足够的能量进行动作，但并未完全进入休眠状态。
          DISABLE_DEACTIVATION (4)： 此状态下，物体将永远不会自动进入休眠状态。
        */

        mBody.data ||= { bodyRb }

        Physics.world.addRigidBody(bodyRb);

        return bodyRb

    }

    /**
     * Create a rigid body from the bounding box
     * @param mBody Graphic Object
     * @param bodyMass The total mass of the rigid body
     * @param shapeType Box and Cylinder default Box
     */
    public static createMeshBoundsRigidBody(mBody: Object3D, bodyMass: number, shapeType: ShapeType = 'Box'): Promise<Ammo.btRigidBody> {
        return new Promise(resolve => {
            const boundSize = BoundUtil.genMeshBounds(mBody).size;
            let shape
            if (shapeType === 'Box') {
                shape = new Ammo.btBoxShape(new Ammo.btVector3(boundSize.x / 2, boundSize.y / 2, boundSize.z / 2));
            } else if (shapeType === 'Cylinder') {
                shape = new Ammo.btCylinderShape(new Ammo.btVector3(boundSize.x / 2, boundSize.y / 2, boundSize.z / 2));
            } else {
                console.error('There is no shape of this type')
            }

            /* Visual object debug physicalVisualDebug  仅在3D对象被ori引擎修改scale后才会对其包围盒尺寸有影响，刚体不受影响，图形对象需要匹配*/
            // mBody.addChild(Object3DUtil.GetSingleCube(boundSize.x / mBody.scaleX, boundSize.y / mBody.scaleY, boundSize.z / mBody.scaleZ, 1, 1, 1))

            const transform = Physics.TEMP_TRANSFORM;

            transform.setIdentity();
            transform.setOrigin(new Ammo.btVector3(mBody.transform.worldPosition.x, mBody.transform.worldPosition.y, mBody.transform.worldPosition.z));
            transform.setRotation(new Ammo.btQuaternion(mBody.transform.localRotQuat.x, mBody.transform.localRotQuat.y, mBody.transform.localRotQuat.z, mBody.transform.localRotQuat.w));

            const motionState = new Ammo.btDefaultMotionState(transform);
            const localInertia = new Ammo.btVector3(0, 0, 0);

            shape.calculateLocalInertia(bodyMass, localInertia);

            const bodyRb = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(bodyMass, motionState, shape, localInertia));

            Ammo.destroy(localInertia)

            resolve(bodyRb);
        });
    }

    /**
     * Create a composite rigid body
     * @param mBody Graphic Object
     * @param bodyMass The total mass of the rigid body
     * @param compoundShapeData  Data required for compound rigid body
     */
    public static createCompoundRigidBody(mBody: Object3D, bodyMass: number, compoundShapeData: RigidBodyData[]): Promise<Ammo.btRigidBody> {
        return new Promise(resolve => {
            const compoundShape = new Ammo.btCompoundShape();
            const btTransform = Physics.TEMP_TRANSFORM;

            compoundShapeData.forEach(rb => {
                const shape = new Ammo.btBoxShape(new Ammo.btVector3(rb.size.width, rb.size.height, rb.size.depth));
                const bodyTransform = btTransform;
                bodyTransform.setIdentity();
                bodyTransform.setOrigin(new Ammo.btVector3(rb.position.x, rb.position.y, rb.position.z));
                rb.rotation && bodyTransform.setRotation(new Ammo.btQuaternion(rb.rotation.x, rb.rotation.y, rb.rotation.z, rb.rotation.w));
                compoundShape.addChildShape(bodyTransform, shape);

                /* Visual object debug physicalVisualDebug */

                // let visualObject = Object3DUtil.GetSingleCube(rb.size.width * 2, rb.size.height * 2, rb.size.depth * 2, Math.random(), Math.random(), Math.random())
                // visualObject.transform.localPosition = new Vector3(rb.position.x, rb.position.y, rb.position.z)
                // if (rb.rotation) {
                //   visualObject.transform.localRotQuat = new Quaternion(rb.rotation.x, rb.rotation.y, rb.rotation.z, rb.rotation.w)
                // }
                // mBody.addChild(visualObject)

            })

            // 1*1*1 box test Visual object debug
            // let visualObject = Object3DUtil.GetSingleCube(1, 1, 1, Math.random(), Math.random(), Math.random())
            // visualObject.transform.localPosition = new Vector3(4, 3.5, 0)
            // mBody.addChild(visualObject)

            btTransform.setIdentity();
            btTransform.setOrigin(new Ammo.btVector3(mBody.transform.worldPosition.x, mBody.transform.worldPosition.y, mBody.transform.worldPosition.z));
            btTransform.setRotation(new Ammo.btQuaternion(mBody.transform.localRotQuat.x, mBody.transform.localRotQuat.y, mBody.transform.localRotQuat.z, mBody.transform.localRotQuat.w));

            const compoundMotionState = new Ammo.btDefaultMotionState(btTransform);

            const compoundShapeLocalInertia = new Ammo.btVector3(0, 0, 0);
            compoundShape.calculateLocalInertia(bodyMass, compoundShapeLocalInertia);

            const bodyRb = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(bodyMass, compoundMotionState, compoundShape, compoundShapeLocalInertia))

            Ammo.destroy(compoundShapeLocalInertia)

            resolve(bodyRb);
        });
    }

    /**
     * Create a hollow composite shape.
     * 相同的参数应用在不同的空心轴上可能会有意外结果，先确定轴向再指定空心区域的大小与偏移。
     * @param outsideSize 
     * @param insideSize 
     * @param offset 
     * @param hollowAxis Specifies the axis along which the hollow section runs: 'X' for left-to-right, 'Y' for top-to-bottom, 'Z' for front-to-back, Defaults to Y.
     * @returns Shapes data
     */
    public static createHollowShapes(
        outsideSize: Vector3,
        insideSize: Vector3,
        offset: Vector3 = Vector3.ZERO,
        hollowAxis: 'X' | 'Y' | 'Z' = 'Y',

    ): RigidBodyData[] {

        let shapesInfo: RigidBodyData[]

        let { x: outsideWidth, y: outsideHeight, z: outsideDepth } = outsideSize.scaleBy(0.5)
        let { x: insideWidth, y: insideHeight, z: insideDepth } = insideSize.scaleBy(0.5)
        let { x: insideOffsetX, y: insideOffsetY, z: insideOffsetZ } = offset.scaleBy(0.5)

        outsideSize = insideSize = offset = null

        insideWidth = Math.min(insideWidth, outsideWidth - 0.01)
        insideHeight = Math.min(insideHeight, outsideHeight - 0.01)
        insideDepth = Math.min(insideDepth, outsideDepth - 0.01)

        insideOffsetX = insideOffsetX > 0 ? Math.min(outsideWidth - insideWidth, insideOffsetX) : Math.max(insideWidth - outsideWidth, insideOffsetX)
        insideOffsetY = insideOffsetY > 0 ? Math.min(outsideHeight - insideHeight, insideOffsetY) : Math.max(insideHeight - outsideHeight, insideOffsetY)
        insideOffsetZ = insideOffsetZ > 0 ? Math.min(outsideDepth - insideDepth, insideOffsetZ) : Math.max(insideDepth - outsideDepth, insideOffsetZ)

        const offsetX = (outsideWidth - insideWidth - insideOffsetX) / 2;
        const offsetY = (outsideHeight - insideHeight - insideOffsetY) / 2;
        const offsetZ = (outsideDepth - insideDepth + insideOffsetZ) / 2;

        // insideOffsetX /= 2
        // insideOffsetY /= 2
        // insideOffsetZ /= 2

        switch (hollowAxis) {
            case 'X': {
                const widthAdjustment = (outsideWidth - insideWidth) / 2
                const baseXOffset = (outsideWidth + insideWidth) / 2;
                shapesInfo = [
                    // front
                    {
                        size: { width: outsideWidth, height: insideHeight, depth: offsetZ },
                        position: { x: 0, y: insideOffsetY, z: offsetZ - outsideDepth }
                    },
                    // back
                    {
                        size: { width: outsideWidth, height: insideHeight, depth: outsideDepth - offsetZ - insideDepth },
                        position: { x: 0, y: insideOffsetY, z: insideDepth + offsetZ }
                    },
                    // top
                    {
                        size: { width: outsideWidth, height: offsetY, depth: outsideDepth },
                        position: { x: 0, y: outsideHeight - offsetY, z: 0 }
                    },
                    // bottom
                    {
                        size: { width: outsideWidth, height: outsideHeight - offsetY - insideHeight, depth: outsideDepth },
                        position: { x: 0, y: -offsetY - insideHeight, z: 0 }
                    },
                    // closed border
                    // left
                    {
                        size: { width: widthAdjustment - insideOffsetX, height: insideHeight, depth: insideDepth },
                        position: { x: baseXOffset + insideOffsetX, y: insideOffsetY, z: insideOffsetZ }
                    },
                    // right
                    {
                        size: { width: widthAdjustment + insideOffsetX, height: insideHeight, depth: insideDepth },
                        position: { x: -baseXOffset + insideOffsetX, y: insideOffsetY, z: insideOffsetZ }
                    }
                ];
            }
                break;

            case 'Y': {
                const heightAdjustment = (outsideHeight - insideHeight) / 2
                const baseYOffset = (outsideHeight + insideHeight) / 2;
                shapesInfo = [
                    // front
                    {
                        size: { width: outsideWidth, height: outsideHeight, depth: offsetZ },
                        position: { x: 0, y: 0, z: offsetZ - outsideDepth }
                    },
                    // back
                    {
                        size: { width: outsideWidth, height: outsideHeight, depth: outsideDepth - offsetZ - insideDepth },
                        position: { x: 0, y: 0, z: insideDepth + offsetZ }
                    },
                    // right
                    {
                        size: { width: offsetX, height: outsideHeight, depth: insideDepth },
                        position: { x: offsetX - outsideWidth, y: 0, z: insideOffsetZ }
                    },
                    // left
                    {
                        size: { width: outsideWidth - offsetX - insideWidth, height: outsideHeight, depth: insideDepth },
                        position: { x: insideWidth + offsetX, y: 0, z: insideOffsetZ }
                    },
                    // closed border
                    // top
                    {
                        size: { width: insideWidth, height: heightAdjustment - insideOffsetY, depth: insideDepth },
                        position: { x: -insideOffsetX, y: baseYOffset + insideOffsetY, z: insideOffsetZ }
                    },
                    // bottom
                    {
                        size: { width: insideWidth, height: heightAdjustment + insideOffsetY, depth: insideDepth },
                        position: { x: -insideOffsetX, y: -baseYOffset + insideOffsetY, z: insideOffsetZ }
                    }
                ];
            }
                break;

            case 'Z': {
                const depthAdjustment = (outsideDepth - insideDepth) / 2
                const baseZOffset = (outsideDepth + insideDepth) / 2;
                shapesInfo = [
                    // top
                    {
                        size: { width: outsideWidth, height: offsetY, depth: outsideDepth },
                        position: { x: 0, y: outsideHeight - offsetY, z: 0 }
                    },
                    // bottom
                    {
                        size: { width: outsideWidth, height: outsideHeight - offsetY - insideHeight, depth: outsideDepth },
                        position: { x: 0, y: -offsetY - insideHeight, z: 0 }
                    },
                    // right
                    {
                        size: { width: offsetX, height: insideHeight, depth: outsideDepth },
                        position: { x: offsetX - outsideWidth, y: insideOffsetY, z: 0 }
                    },
                    // left
                    {
                        size: { width: outsideWidth - offsetX - insideWidth, height: insideHeight, depth: outsideDepth },
                        position: { x: insideWidth + offsetX, y: insideOffsetY, z: 0 }
                    },
                    // closed border
                    // front
                    {
                        size: { width: insideWidth, height: insideHeight, depth: depthAdjustment - insideOffsetZ },
                        position: { x: -insideOffsetX, y: insideOffsetY, z: baseZOffset + insideOffsetZ }
                    },
                    // back
                    {
                        size: { width: insideWidth, height: insideHeight, depth: depthAdjustment + insideOffsetZ },
                        position: { x: -insideOffsetX, y: insideOffsetY, z: -baseZOffset + insideOffsetZ }
                    }
                ];
            }
                break;
        }

        // Fix borders and filter unwanted borders
        return shapesInfo.reduce((accumulator, shape) => {
            if (shape.size.width > 0.01 && shape.size.height > 0.01 && shape.size.depth > 0.01) {
                if (shape.size.width > outsideWidth) {
                    shape.size.width = outsideWidth;
                    shape.position.x = 0;
                }
                if (shape.size.height > outsideHeight) {
                    shape.size.height = outsideHeight;
                    shape.position.y = 0;
                }
                if (shape.size.depth > outsideDepth) {
                    shape.size.depth = outsideDepth;
                    shape.position.z = 0;
                }
                accumulator.push(shape);
            }
            return accumulator;
        }, []);
    }

    /**
     * Reset the rigid body transform
     * @param bodyRb rigid body
     * @param newPosition
     * @param newRotation
     */
    public static resetRigidBody(bodyRb: Ammo.btRigidBody, newPosition: Vector3, newRotation: Quaternion): void {

        const transform = Physics.TEMP_TRANSFORM;

        transform.setOrigin(new Ammo.btVector3(newPosition.x, newPosition.y, newPosition.z));
        transform.setRotation(new Ammo.btQuaternion(newRotation.x, newRotation.y, newRotation.z, newRotation.w));

        bodyRb.setWorldTransform(transform);
        bodyRb.clearForces();
        bodyRb.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
        bodyRb.setAngularVelocity(new Ammo.btVector3(0, 0, 0));

    }

    /**
     * Destroy the rigid body Or meanwhile clear the reference
     * @param mBody Graphic Object. needs 'mBody.data.bodyRb = rigid body'
     * @param bodyRb Rigid body
     */
    public static destroyRigidBody(mBody: Object3D = null, bodyRb: Ammo.btRigidBody = null): void {

        if (!mBody && !bodyRb) return

        bodyRb ||= mBody?.data?.bodyRb

        if (!bodyRb) return

        Physics.world.removeRigidBody(bodyRb);

        Ammo.destroy(bodyRb.getCollisionShape());
        Ammo.destroy(bodyRb.getMotionState());
        Ammo.destroy(bodyRb);

        if (mBody?.data?.bodyRb) mBody.data.bodyRb = null

    }

    /**
     * Destroy the rigid body Constraint Or meanwhile clear the reference
     * @param mBody Graphic Object. needs 'mBody.data.bodyRbConstraint = constraint'
     * @param constraint Rigid body constraint
     */
    public static destroyConstraint(mBody: Object3D = null, constraint: Ammo.btTypedConstraint = null): void {

        if (!mBody && !constraint) return

        constraint ||= mBody?.data?.bodyRbConstraint

        constraint && Physics.world.removeConstraint(constraint)
        constraint && Ammo.destroy(constraint)

        if (mBody?.data?.bodyRbConstraint) mBody.data.bodyRbConstraint = null

    }
}
