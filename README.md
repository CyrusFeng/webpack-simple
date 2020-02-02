
webpack是一个功能丰富且复杂的打包工具，使用时需要掌握Loader、Plugin等等概念，不过其核心功能就是将浏览器看不懂的代码翻译成可执行代码，为了快速掌握webpack的实现思路，让我们抛开那些繁琐的概念，看看打包工具是如何翻译模块化代码的。


#### webpack核心功能切入点
现有的`commonJS`规范和`es6`模块化方案等浏览器并不支持，也就是说我们在`node`环境下执行的好好的`require、exports`浏览器无法识别。现在以`commonJS`规范为例，如果我们使用`commonJS`进行模块化，首先要解决的问题是如何让浏览器识别`require`和`exports`。

先观察一下`require`这个关键字，我们会发现它实际上就是一个函数，接收的参数是一个路径，只不过在`node`环境下天然存在这样一个函数供你使用。浏览器不认识`require`是因为浏览器并没有帮你去声明`require`。所以打包工具要做的就是要实现一个`require`取代代码中的`require`。那么问题又来了，怎么才能在不改动源码的情况下代替原有`require`呢？其实答案很明显了，把我们实现的`require`当做参数传递给这个模块就好了。

实际上现在我们的模块化、以单文件形式进行作用域隔离等，在之前都是使用立即执行函数去做的，我们可以借鉴前辈们的方法，**将模块中的内容放入一个函数中，将自定义的`require`和`exports`作为实参传递给这个函数**，从而达到替换原有`require`和`exports`的作用。
```
let what = require('./eat')
let where = require('./run')
exports.name = `mayun eat ${whatObj.what} run to ${whereObj.where}`

//转换为下面的形式
function(require,exports){
  let what = require('./eat')
  let where = require('./run')
  exports.name = `mayun eat ${whatObj.what} run to ${whereObj.where}`
}
```
现在我们需要将这些松散的模块组织在一起，将他们放入对象中是一种不错的形式。同时，每个模块都需要一个名字方便我们找到它，所以我们**给每个模块一个不重复的`id`**：
```
let modules = {
  0: function (require, exports) {
    let whatObj = require('./eat')
    let whereObj = require('./run')
    exports.action = `mayun eat ${whatObj.what} run to ${whereObj.where}`
  },
  1: function (require, exports) {
    exports.what = '火锅'
  },
  2: function (require, exports) {
    exports.where = '北京'
  },
}
```
接下来就需要去声明一个`require`方法和一个函数，让这个函数去执行`modules`中的函数，我们给它起名叫`exec`。大概像这样：
```
function exec(id) {
  let fn = modules[id]
  let exports = {}
  // 模拟 require 语句
  function require(path) {

  }
  // 执行存放所有模块数组中的第0个模块
  fn(require,exports)
}
exec(0)
```
现在我们已经得到了`bundle.js`的雏形（对，就是`webpack`打包后生成的那个东西）。`require`函数的实现我们先放在一边，现在再来思考一个问题，打包工具需要通过原`require`中的路径找到对应的模块，但是`modules`对象被整合出来后，各个模块代码脱离了之前的位置，所以我们很难再通过这个相对路径去寻找对应的模块文件了。既然我们已经抽离出需要的模块代码，我们是不是可以直接做一个映射，将相对路径和被抽离出来的模块对应起来呢？**为了让每个模块都可以通过这个映射找到依赖模块，我们就给这个模块加一个`mapping`**，正好现在模块id和代码已经一一对应了，修改一下`modules`的结构即可。我们**让模块id对应一个数组，之前的模块代码现在放在数组第0个位置，它的`mapping`放在数组的第1个位置**：
```
let modules = {
  0: [function (require, exports) {
    let whatObj = require('./eat')
    let whereObj = require('./run')
    exports.action = `mayun eat ${whatObj.what} run to ${whereObj.where}`
  }, {
    './eat': 1,
    './run': 2,
  }
  ],
  1: [function (require, exports) {
    exports.what = '火锅'
  }, {}
  ],
  2: [function (require, exports) {
    exports.where = '北京'
  }, {}
  ],
}
```
按照新的数据结构，我们调整一下`exec`函数的实现：
```
function exec(id) {
  let [fn,mapping] = modules[id]
  let exports = {}
  fn(require, exports)

  function require(path) {
    return exec(mapping[path])
  }

  return exports
}
exec(0)
```
当目前为止我们已经做到使用`exec`函数可以顺利执行转换后的`modules`了，所以接下来的重点就是如何将模块文件读取出来生成`modules`。先捋清思路，首先我们需要读取入口文件，拿到入口文件的依赖，同时将入口文件代码和依赖组成数组追加到`modules`中；拿到依赖后，读取依赖文件，重复上一步操作。很显然这时候我们需要用到`nodejs`。不管怎么说，我们先实现一个拿到模块代码中依赖项的方法，可以使用正则去匹配`require`中的路径：
```
// 获取模块依赖数组
function getDependencies(str){
  let reg = /require\(['"](.+?)['"]\)/g
  let result = null
  let dependencies = []
  // 通过正则匹配到require括号中的相对路径，存放在数组中
  while(result = reg.exec(str)){
    dependencies.push(result[1])
  }
  return dependencies
}
```
此时将读取的文件内容作为参数传递给`getDependencies`即可：
```
// 获取入口文件内容
let fileContent = fs.readFileSync('./index.js','utf-8')
console.log(getDependencies(fileContent))

[ './people.js' ]
```
这时候我们回过头看一下`modules`的结构，既然需要得到关于这个模块的多种信息，我们最好是封装一个函数返回这个模块的信息：
```
// 全局变量 作为模块的id
let id = 0
// 根据文件路径获取文件信息并生成一个对象
function getModule(filename){
  let fileContent = fs.readFileSync(filename,'utf-8')
  return {
    id:id++,
    filename:filename,
    dependencies:getDependencies(fileContent),
    code:`function(require,exports){
         ${fileContent}
    }`,
  }
}
```
现在我们有了入口文件对象的信息，可以将它放在一个数组里，接下来就是根据这个入口对象的依赖获取到依赖模块对象信息，并且`push`到对象数组中，生成一个资源列表。现在我们来实现这个函数：
```
// 传入入口文件路径，生成模块数组
function getGraph(filename){
  let indexModule = getModule(filename)
  let graph = [indexModule]

  // tips:这里使用for of非常便利，因为循环后数组项会动态增加，
  // for of语句会在已经循环过的基础上继续循环，而不会从头再循环一次
  for(let value of graph){
    value.mapping = {}
    value.dependencies.forEach((relativePath)=>{
      const absolutePath = path.join(__dirname,relativePath)
      let module = getModule(absolutePath)
      value.mapping[relativePath] = module.id
      graph.push(module)
    })
  }
}
```
准备工作都已经做好，现在只需要把上面获取到的数据转换成`modules`，再把`modules`和`exec`函数拼接成字符串写入到一个名为`bundle.js`的文件中，这个js文件就可以无障碍的在浏览器中执行了：
```
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

  // 写入到bundle.js中
  fs.writeFileSync('./dist/bundle.js',result)
}
```