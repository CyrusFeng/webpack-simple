const fs = require('fs')
const path = require('path')

// 获取入口文件内容
let fileContent = fs.readFileSync('./index.js', 'utf-8')

// 获取模块依赖数组
function getDependencies(str) {
  let reg = /require\(['"](.+?)['"]\)/g
  let result = null
  let dependencies = []

  // 通过正则匹配到require括号中的相对路径，存放在数组中
  while (result = reg.exec(str)) {
    dependencies.push(result[1])
  }
  return dependencies
}

// 全局变量 作为模块的id
let id = 0

// 根据文件路径获取文件信息并生成一个对象
function getModule(filename) {
  let fileContent = fs.readFileSync(filename, 'utf-8')
  return {
    id: id++,
    filename: filename,
    dependencies: getDependencies(fileContent),
    code: `function(require,exports){
         ${fileContent} 
    }`,
  }
}

// 传入入口文件路径，生成模块数组
function getGraph(filename) {
  let indexModule = getModule(filename)
  let graph = [indexModule]

  // tips:这里使用for of非常便利，因为循环后数组项会动态增加，
  // for of语句会在已经循环过的基础上继续循环，而不会从头再循环一次

  for (let value of graph) {
    value.mapping = {}
    value.dependencies.forEach((relativePath) => {
      const absolutePath = path.join(__dirname, relativePath)
      let module = getModule(absolutePath)
      value.mapping[relativePath] = module.id
      graph.push(module)
    })
  }
  return graph
}

// 生成浏览器可执行的代码并写入bundle.js中
function createBundle(graph) {
  let modules = ''
  // 生成modules字符串
  graph.forEach((module) => {
    modules += `${module.id}:[
      ${module.code},
      ${JSON.stringify(module.mapping)}
    ],`
  })
  // 生成立即执行函数，并且将moudules作为参数传递进去
  let result = `(function f(modules) {
    function exec(id) {
      let [fn, mapping] = modules[id]
      let exports = {}
      fn && fn(require, exports)

      function require(path) {
        return exec(mapping[path])
      }

      return exports
    }

    exec(0)
  })({${modules}})`

  fs.writeFileSync('./dist/bundle.js',result)
}

createBundle(getGraph('./index.js'))