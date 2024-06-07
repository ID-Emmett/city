import { View3D, Engine3D, Scene3D, CameraUtil, Object3D, DirectLight, KelvinUtil, Vector3, PostProcessingComponent, DepthOfFieldPost, Camera3D, SkyRenderer, TAAPost, Time, GTAOPost, HoverCameraController } from '@orillusion/core'
import { Ammo, Physics, Rigidbody } from '@orillusion/physics';
import { Stats } from "@orillusion/stats"
import { SceneModels } from '@/components/sceneModels'
import * as dat from 'dat.gui';

Engine3D.setting.shadow.shadowSize = 1024 * 4;
Engine3D.setting.shadow.csmMargin = 0.1 // 设置不同级别阴影的过渡范围，在0-1区间调节
Engine3D.setting.shadow.csmScatteringExp = 0.7 // 微调各个级别阴影的范围，以满足不同的场景需求
Engine3D.setting.shadow.csmAreaScale = 0.6 // 微调阴影能够覆盖的最大范围，在0.0-1区间调节
Engine3D.setting.shadow.updateFrameRate = 1 // 阴影更新

class Game {
    scene: Scene3D;
    camera: Camera3D;
    hoverCamera: HoverCameraController;
    async run() {

        await Physics.init();

        await Engine3D.init({
            // renderLoop: () => Physics.update(),
            renderLoop: () => Physics.world.stepSimulation(Time.delta / 1000, 10, 1 / 60),
            canvasConfig: {
                devicePixelRatio: 1
            }
        })

        let view = new View3D();
        view.scene = new Scene3D();
        this.scene = view.scene
        this.scene.addComponent(Stats);

        let textureCube = await Engine3D.res.loadTextureCubeMaps([
            'sky/px.jpg',
            'sky/nx.jpg',
            'sky/py.jpg',
            'sky/ny.jpg',
            'sky/pz.jpg',
            'sky/nz.jpg',
        ])
        let sky = this.scene.addComponent(SkyRenderer);
        sky.map = textureCube;
        sky.exposure = 0.5
        view.scene.envMap = textureCube;


        view.camera = this.camera = CameraUtil.createCamera3DObject(view.scene, 'camera');
        view.camera.perspective(55, Engine3D.aspect, 1, 4000);
        view.camera.enableCSM = true;

        let hoverCamera = this.hoverCamera = view.camera.object3D.addComponent(HoverCameraController);
        hoverCamera.maxDistance = 2000;
        hoverCamera.dragSmooth = 5;
        hoverCamera.wheelSmooth = 5;
        hoverCamera.rollSmooth = 5;
        hoverCamera.wheelStep = 0.02;
        hoverCamera.setCamera(120, -25, 200);

        this.createDirectLight();

        Engine3D.startRenderView(view);

        let gui = new dat.GUI();

        this.addPostProcessing(gui);
        this.initGameComponents(gui);
    }

    createDirectLight() {
        let lightObj3D = new Object3D();
        lightObj3D.localPosition = new Vector3(10, 10, 10);
        lightObj3D.localRotation = new Vector3(40, 25, 10);

        let directLight = lightObj3D.addComponent(DirectLight);
        directLight.intensity = 90;
        directLight.lightColor = KelvinUtil.color_temperature_to_rgb(6123);
        directLight.castShadow = true;

        this.scene.addChild(lightObj3D);
    }

    initGameComponents(gui: any) {

        // 场景模型
        let sceneModel = this.scene.addComponent(SceneModels);
        sceneModel.hoverCamera = this.hoverCamera;
        sceneModel.gui = gui;
    }

    addPostProcessing(gui: any) {
        let postProcessing = this.scene.addComponent(PostProcessingComponent);
        {
            let post = postProcessing.addPost(GTAOPost);
            post.enable = false;
            let f = gui.addFolder('GTAOPost');
            f.add(post, 'enable');
            f.add(post, "maxDistance", 0.0, 149, 1);
            f.add(post, "maxPixel", 0.0, 150, 1);
            f.add(post, "rayMarchSegment", 0.0, 50, 0.001);
            f.add(post, "darkFactor", 0.0, 5, 0.001);
            f.add(post, "blendColor");
            f.add(post, "multiBounce");
        }
        {
            let post = postProcessing.addPost(DepthOfFieldPost);
            post.enable = false;
            let f = gui.addFolder('DepthOfFieldPost');
            f.add(post, 'enable');
            f.add(post, 'near', 0, 100, 1);
            f.add(post, 'far', 150, 300, 1);
            f.add(post, 'pixelOffset', 0.0, 15, 1);
        }
        {
            let post = postProcessing.addPost(TAAPost);
            post.enable = false;
            let f = gui.addFolder('TAAPost');
            f.add(post, 'enable');
            f.add(post, 'jitterSeedCount', 0, 8, 2);
            f.add(post, 'blendFactor', 0, 1, 0.1);
            f.add(post, 'sharpFactor', 0.1, 0.9, 0.1);
            f.add(post, 'sharpPreBlurFactor', 0, 0.9, 0.1);
            f.add(post, 'temporalJitterScale', 0, 1, 0.1);
        }
    }

}

new Game().run()
