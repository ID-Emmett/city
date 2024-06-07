import { Ammo, Physics } from '@orillusion/physics';

type RigidBodyData = {
    type: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number, w: number };
    size: { width: number; height: number; depth: number };
    regionId?: string;
};

type RigidBody = Ammo.btRigidBody;

export class StaticRigidBodyManager {
    private bodiesByRegion: { [key: string]: RigidBody[] } = {};

    private btTransform: Ammo.btTransform = new Ammo.btTransform()
    readonly rigidBodyRegion: string[] = ['0-1', '0-2', '0-3', '0-4', '0-5', '1-1', '1-2', '1-3', '1-4', '1-5', '1-7', '1-8', '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '2-8', '2-9', '3-1', '3-2', '3-3', '3-4', '3-5', '3-7', '3-8', '3-9', '4-2', '4-3', '4-4', '4-5']

    async createBodiesForRegionAsync(regionId: string): Promise<(() => void)[]> {

        if (this.rigidBodyRegion.indexOf(regionId) === -1) return [];

        const response = await fetch(`json/staticRigidBodyData/static_area_${regionId}.json`)
        const bodiesInRegion = await response.json() as RigidBodyData[];

        const tasks: (() => void)[] = [];

        for (const data of bodiesInRegion) {
            tasks.push(() => {
                const body = this.createRigidBody(data);
                this.addBodyToWorld(body, regionId);
            })
        }
        return tasks
    }

    addBodyToWorld(body: RigidBody, regionId: string) {
        Physics.world.addRigidBody(body);

        if (!this.bodiesByRegion[regionId]) {
            this.bodiesByRegion[regionId] = [];
        }
        this.bodiesByRegion[regionId].push(body);
    }

    createRigidBody(data: RigidBodyData): RigidBody {
        let shape: Ammo.btCollisionShape;

        if (data.type === "Solid") {
            shape = new Ammo.btBoxShape(new Ammo.btVector3(data.size.width, data.size.height, data.size.depth));
        } else if (data.type === "Plane") {
            // 使用薄盒子代替平面
            shape = new Ammo.btBoxShape(new Ammo.btVector3(data.size.width, 0.01, data.size.depth));
        } else {
            // 圆柱
            shape = new Ammo.btCylinderShape(new Ammo.btVector3(data.size.width, data.size.height, data.size.width));
        }
        // shape.setMargin(0.05)

        let transform = this.btTransform;
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(data.position.x, data.position.y, data.position.z));
        transform.setRotation(new Ammo.btQuaternion(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w));

        let body = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(0, null, shape));

        // 直接设置刚体的世界变换
        body.setWorldTransform(transform);

        return body;
    }

    destroyBodiesForRegionAsync(regionId: string): (() => void)[] {
        const bodiesToDestroy = this.getAllBodiesForRegion(regionId);

        const tasks: (() => void)[] = [];

        for (const body of bodiesToDestroy) {
            tasks.push(() => {
                this.removeBodyFromWorld(body, regionId);
            })
        }

        return tasks
    }

    getAllBodiesForRegion(regionId: string): RigidBody[] {
        return this.bodiesByRegion[regionId] || [];
    }

    removeBodyFromWorld(body: RigidBody, regionId: string) {

        if (body) {
            Physics.world.removeRigidBody(body);
            const collisionShape = body.getCollisionShape();
            Ammo.destroy(body);
            Ammo.destroy(collisionShape);
        }

        const regionBodies = this.bodiesByRegion[regionId];
        if (regionBodies) {
            const index = regionBodies.indexOf(body);
            if (index !== -1) {
                regionBodies.splice(index, 1);
            }
        }
    }
}


