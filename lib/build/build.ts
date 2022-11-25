import fs from 'fs';
import { ComponentExportTemplate, ComponentImportTemplate, ComponentNameTemplate, StyleImportTemplate } from '../../constants';
import { sanitizeConfigPaths, sanitizePath, createDirIfNotExist, buildFile, readTemplateFile } from '../../utils';
import { IConfigObject } from '../types';
import { componentBuildPrompt } from './prompt.build';

function getFullFileName(name: string, extension: string) {
  return `${name}${extension}`;
}

function getFullFileNames(configFile: IConfigObject, componentName: string) {
  const FILE_NAMES: Record<string, string> = {};
  for(const [key, value] of Object.entries(configFile)) {
    FILE_NAMES[key] = getFullFileName(componentName, value.suffixExtension) 
  }
  return FILE_NAMES;
}

(async () => {
  // Get configs from rfsb.config.json file
  const { name, componentEntryPoint, ...configRest } = JSON.parse(fs.readFileSync('rfsb.config.json', { encoding: 'utf8' }));
  // Clean component entry point path
  const COMPONENTS_ROOT_DIR = sanitizePath(componentEntryPoint);

  const { chosenComponentName: ComponentName, promptResponse } = await componentBuildPrompt(configRest);
  
  const responsesType = promptResponse.map(({ type }) => type);
  const FILE_NAMES = getFullFileNames(configRest, ComponentName);
  
  // For each key create a file dynamically filled with template file's content
  for (const [key, aConfig] of Object.entries(sanitizeConfigPaths(configRest, ComponentName))) {
    const FILE_NAME = FILE_NAMES[key];
    const RELATIVE_PATH = aConfig.path || `${COMPONENTS_ROOT_DIR}/${ComponentName}/`;
    createDirIfNotExist(RELATIVE_PATH);

    // Go to the next config if this one hasn't been picked by the user
    if (!responsesType.includes(key)) {
      continue
    }

    if (key === 'component') {
      // TODO : Import default props into component and set it up
      // TODO : When we have no style import go one line upward'\b'
      const componentExportString = aConfig.export === 'module' ? `{ ${ComponentName} }` : `default ${ComponentName}`;
      const STYLESHEET_DIRECTORY = configRest.style.path ? `${configRest.style.path}/` : '';
      const STYLESHEET_IMPORT_PATH = `./${STYLESHEET_DIRECTORY}${FILE_NAME};`
      const styleImportString = configRest.style.import === 'module' ? `import styles from '${STYLESHEET_IMPORT_PATH}';` : `import '${STYLESHEET_IMPORT_PATH}';`;

      // Dynamically replace template's tags with the right content
      const formatedTemplate = JSON.stringify(readTemplateFile(key))
        .replaceAll(ComponentNameTemplate, ComponentName)
        .replaceAll(ComponentExportTemplate, componentExportString)
        .replaceAll(StyleImportTemplate, responsesType.includes('style') ? styleImportString : '');

      // Build component file
      buildFile(`${RELATIVE_PATH}/${FILE_NAME}`, JSON.parse(formatedTemplate));
    }
    if (key === 'test') {
      const COMPONENT_DIR = configRest.component.path ? `${configRest.component.path}/` : '';
      const COMPONENT_IMPORT_PATH = `./${COMPONENT_DIR}${FILE_NAME}`;
      const FULL_COMPONENT_FILE_IMPORT_STRING = `import ${configRest.component.export === 'default' ? ComponentName : `{ ${ComponentName} }`} from '${COMPONENT_IMPORT_PATH}'`

      // Dynamically replace template's tags with the right content
      const formatedTemplate = JSON.stringify(readTemplateFile(key))
        .replaceAll(ComponentNameTemplate, ComponentName)
        .replaceAll(ComponentImportTemplate, FULL_COMPONENT_FILE_IMPORT_STRING);

      // Build test file
      buildFile(`${RELATIVE_PATH}/${FILE_NAME}`, JSON.parse(formatedTemplate));
    }
    if (key === 'props') {
      // Dynamically replace template's tags with the right content
      const formatedTemplate = JSON.stringify(readTemplateFile(key))
        .replaceAll(ComponentNameTemplate, ComponentName);

      // Build props file
      buildFile(`${COMPONENTS_ROOT_DIR}/${ComponentName}/${FILE_NAME}`, JSON.parse(formatedTemplate));
    }
    if (key === 'style') {
      // Build style sheet
      buildFile(`${RELATIVE_PATH}/${FILE_NAME}`, '');
    }

    buildFile(`${RELATIVE_PATH}/${FILE_NAME}`, '');

  }
})()

// "fill": false     /* if user doesn't want his file filled up