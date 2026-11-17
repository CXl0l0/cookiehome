import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const dep='C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-611-0_26.1112.611.0_x64__3k8sg7r9htsxt/dependencies';
process.env.RUNTIME_NODE_MODULES=dep+'/node/node_modules';
const root='C:/Users/User/Desktop/cookiehome';const build=root+'/tmp/presentation-revision';
const skill='C:/Users/User/.codex/plugins/cache/openai-primary-runtime/presentations/26.1112.11011/skills/presentations';
const {PresentationFile,FileBlob}=await import(pathToFileURL(dep+'/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs'));
const {finalizePresentation}=await import(pathToFileURL(skill+'/container_tools/artifact_tool_utils.mjs'));
const result=await finalizePresentation({workspaceDir:root,candidatePath:build+'/candidate.pptx',finalPath:build+'/final/validated-v4.pptx',pythonExecutable:dep+'/python/python.exe',integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit','--require-native-table-slide','5','--require-native-table-slide','9'],explicitTotalSlideCount:11,requiredNativeTableOwnerSlides:[5,9],verifyArtifactToolImport:true,receiptPath:build+'/validation-v4.json'});
console.log(JSON.stringify(result));
const p=await PresentationFile.importPptx(await FileBlob.load(build+'/final/validated-v4.pptx'));
await fs.mkdir(build+'/final-render',{recursive:true});
for(let i=0;i<p.slides.items.length;i++){const blob=await p.export({slide:p.slides.items[i],format:'png',scale:1});await fs.writeFile(build+'/final-render/slide-'+(i+1)+'.png',new Uint8Array(await blob.arrayBuffer()));}
