/**
 * 这个配置文件决定模块库中哪些文件应该被编译
 */
var build_conf = {
    in_param:{//编译的输入参数
        path:'./src/modules/',
        modules:['mh.table'], //需要编译的模块，它们所依赖的模块也会被编译
    },
    out_param:{//编译的输出参数
        js:{
            filename:'mhLib',//js编译后的文件名
            uglify:true      //是否丑化
        },
        css:{
            filename:'mhLib',//css编译后的文件名
            uglify:true      //是否丑化
        },
        assets:{
            rpath:'assets',  //编译后的资源（除了js和css外的文件）应该存在的目录
            usemin:true,     //压缩处理，能够被压缩的资源将被压缩
        },
        options:{
            hash_name:true,  //给文件名加上hash的后缀
        }
    }
};

module.exports = build_conf;