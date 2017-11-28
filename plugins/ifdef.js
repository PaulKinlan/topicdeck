// Removes some IF DEFS
export default function jspp (options) {
    if (!options) options = {}
    if (!options.ifdef) options.ifdef = 'WEB'
  
    return {
      name: 'ifdef',
  
      transform (code, id) {
        code = code.replace(`// IF_DEF ${options.ifdef} `, '')
        return { code: code };
      }
    }
  }