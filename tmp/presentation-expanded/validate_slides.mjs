import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const dep="C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-611-0_26.1112.611.0_x64__3k8sg7r9htsxt/dependencies";
process.env.RUNTIME_NODE_MODULES=dep+'/node/node_modules';
const skill="C:/Users/User/.codex/plugins/cache/openai-primary-runtime/presentations/26.1112.11011/skills/presentations";
const root='C:/Users/User/Desktop/cookiehome',b=root+'/tmp/presentation-expanded';
const {finalizePresentation}=await import(pathToFileURL(skill+'/container_tools/artifact_tool_utils.mjs'));
const tables=JSON.parse(await fs.readFile(b+'/table-owners.json','utf8'));
await fs.mkdir(b+'/final',{recursive:true});
const result=await finalizePresentation({workspaceDir:root,candidatePath:b+'/candidate.pptx',finalPath:b+'/final/validated.pptx',
pythonExecutable:dep+'/python/python.exe',integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',
layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',
layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...tables.flatMap(n=>['--require-native-table-slide',String(n)])],
explicitTotalSlideCount:26,requiredNativeTableOwnerSlides:tables,verifyArtifactToolImport:true,receiptPath:b+'/validation.json'});
console.log(JSON.stringify(result));
