import { Engine3D, Scene3D, ComponentBase, Object3D, MeshRenderer, PlaneGeometry, VertexAttributeName, Vector4, LitMaterial, BlendMode, Color, Material, Time, BitmapTexture2D, Texture } from '@orillusion/core'
import { perlinNoise, createNoiseSeed } from '@/utils/perlin.js';

createNoiseSeed(0.1)

export class Water extends ComponentBase {

    private _material: Material

    public async start() {

        let waterBaseMap = await Engine3D.res.loadTexture('texture/Scene_-_Root_baseColor.png');
        let waterNormalMap = await Engine3D.res.loadTexture('texture/water_n.jpg');

        let seabedBaseMap = await Engine3D.res.loadTexture('texture/Concrete026_2K-PNG_Color.png');
        let seabedNormalMap = await Engine3D.res.loadTexture('texture/sandstone_cracks_nor_gl_1k.png');

        const seabed = await this.createSeabed(seabedBaseMap, seabedNormalMap)
        const water = await this.createWater(waterBaseMap, waterNormalMap)

        this.object3D.addChild(water)
        this.object3D.addChild(seabed)
    }

    // 水面
    private async createWater(waterBaseMap: Texture, waterNormalMap: Texture): Promise<Object3D> {

        let water = new Object3D()
        water.name = 'water'
        water.y = -10.5
        let mr = water.addComponent(MeshRenderer)
        mr.geometry = new PlaneGeometry(3000, 3000, 50, 50);

        let posAttrData = mr.geometry.getAttribute(VertexAttributeName.position);

        for (let i = 0, count = posAttrData.data.length / 3; i < count; i++) {

            posAttrData.data[i * 3 + 1] = perlinNoise(posAttrData.data[i * 3 + 0], posAttrData.data[i * 3 + 2])

        }

        mr.geometry.vertexBuffer.upload(VertexAttributeName.position, posAttrData);

        mr.geometry.computeNormals();

        let mat = new LitMaterial()
        mat.baseMap = waterBaseMap
        mat.normalMap = waterNormalMap
        mat.metallic = 0.1
        mat.roughness = 0
        mat.baseColor = new Color(0, 0.045, 0.1, 0.1)


        mat.alphaCutoff = 0.1;
        mat.baseColor.a = 0.1;
        mat.transparent = true;
        mat.blendMode = BlendMode.ADD;
        mr.receiveShadow = false
        mr.material = this._material = mat

        return water

    }

    // 水底
    private async createSeabed(seabedBaseMap: Texture, seabedNormalMap: Texture): Promise<Object3D> {

        let seabed = new Object3D()
        seabed.name = 'seabed'
        seabed.y = -33
        let mr = seabed.addComponent(MeshRenderer)
        mr.geometry = new PlaneGeometry(3000, 3000, 50, 50);

        // 获得现有顶点信息
        let posAttrData = mr.geometry.getAttribute(VertexAttributeName.position);

        // 重写顶点坐标
        for (let i = 0, count = posAttrData.data.length / 3; i < count; i++) {

            let x = posAttrData.data[i * 3 + 0];
            let z = posAttrData.data[i * 3 + 2];

            // 判断顶点是否在边缘
            if (Math.abs(x) >= 3000 / 2 - 3000 / 50 || Math.abs(z) >= 3000 / 2 - 3000 / 50) {
                posAttrData.data[i * 3 + 1] = perlinNoise(posAttrData.data[i * 3 + 0], posAttrData.data[i * 3 + 2], 1) + 33 - 10.5 + 10

            } else {
                posAttrData.data[i * 3 + 1] = perlinNoise(posAttrData.data[i * 3 + 0], posAttrData.data[i * 3 + 2])


            }
        }

        mr.geometry.vertexBuffer.upload(VertexAttributeName.position, posAttrData);
        mr.geometry.computeNormals();

        let mat = new LitMaterial()
        mat.setUniformVector4('transformUV1', new Vector4(0, 0, 10, 10))
        mat.baseMap = seabedBaseMap
        mat.normalMap = seabedNormalMap
        mat.metallic = 0.1
        mat.roughness = 0
        mat.emissiveIntensity = 10

        mat.alphaCutoff = 0.1;
        mat.blendMode = BlendMode.SCREEN;
        mr.receiveShadow = false
        mr.material = mat

        return seabed
    }

    public onUpdate(): void {
        if (this._material) {
            let x = Time.time * 0.00002
            let y = Time.time * 0.0001
            this._material.setUniformVector4(`transformUV1`, Vector4.HELP_0.set(x, y, 15, 20));
        }
    }

}