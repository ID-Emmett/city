<script setup lang="ts">
import { onBeforeMount, onUnmounted, } from "vue";

// 入口路径
let modules = import.meta.glob("./Game.ts");

let path: string;
for (const _path in modules) {
    path = _path.substring(1)
}

let manifestFile: any

async function loadManifest() {
    try {
        const response = await fetch('manifest.json');
        if (!response.ok) {
            throw new Error('Failed to load manifest');
        }
        return response.json();
    } catch (error) {
        console.error('Error loading manifest:', error);
        throw error;
    }
}

function addIframe() {
    const iframe = document.createElement("iframe") as HTMLIFrameElement;

    let fillpath = `src${path}`
    if (import.meta.env.PROD) {
        fillpath = `${__APP_NAME__}/${manifestFile[fillpath].file}` // 通过获取包含源文件路径到构建文件路径的映射的 manifest 文件来动态载入脚本。
    }

    // console.log(fillpath);

    iframe.srcdoc = `
		<style>html,body{margin:0;padding:0;overflow:hidden;height: 100%;width: 100%;}canvas{touch-action:none}.dg{z-index:1 !important;}</style>
		<script>
			import('/${fillpath}');
		</script` + ">";
    document.querySelector("#app")?.appendChild(iframe);
}

onBeforeMount(async () => {
    manifestFile = import.meta.env.PROD && await loadManifest();
    addIframe();
});

onUnmounted(() => {
    removeIframe();
});

function removeIframe() {
    document.querySelector("#app iframe")?.remove();
}
</script>

<template>
</template>
