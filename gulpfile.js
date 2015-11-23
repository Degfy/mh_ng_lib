var gulp    = require('gulp');
var concat  = require('gulp-concat');
var uglify  = require('gulp-uglify');
var replace = require('gulp-replace');
var fs      = require('fs');
var Promise = require('promise');
var clean   = require('gulp-clean');
var ngAnnotate = require('gulp-ng-annotate');
var sass    = require('gulp-sass');
var uglifycss = require('gulp-uglifycss');
var nop     = require('gulp-nop');
var jade    = require('gulp-jade');
var html2js = require('gulp-html2js')

function noop(){};//一个空函数

function mc_module(path){
    this.path = path.match(/[\\\/]$/)?path:path+'/';
};

mc_module.prototype.concat = function(module_name,finishCall) {
    finishCall = finishCall || noop;
    var path = this.path + module_name;
    
    return gulp
    .src([
        'module.prefix',
        path + '/*.js',
        path + '/**/*.js',
        'module.suffix'
    ])
    .pipe(concat(module_name + '.js'))
    .pipe(replace('$__mc_module_name',module_name))
    .pipe(gulp.dest('.tmp/modules'))
    .on('end',finishCall);
};

/**
 * 读取配置文件，如果配置文件不存在，则生成一个
 * @param  {[type]} configFile 配置文件名，不包含后缀名（.js）
 * @return {[type]}            [description]
 */
function mc_config(configFile,path){
    configFile = (configFile || 'build.conf') + '.js';
    path = path || './';
    var promise = new Promise(function(resolve, reject){
        fs.exists(path + configFile,function(exists){
            if(exists){
                resolve(require(path + configFile));
            }
            else
            {
                gulp
                .src('build.conf.sample.js')
                .pipe(concat(configFile))
                .pipe(gulp.dest(path))
                .on('end',function(file){
                    resolve(require(path + configFile));
                });
            }
        });
    });
    return promise;
}


var depend_modules = [];
var build_config;

//分析依赖关系
gulp.task('dev-analyze',function(){
    console.log('依赖分析开始...');
    var noopStream = nop();

    if(depend_modules.length > 0){
        setTimeout(function(){
            noopStream.push(null);
        },0);
    }
    else
    {
        mc_config()
        .then(function(config){
            build_config = config;
            var need_build_modules = config.in_param.modules || [];
            for(var i = 0; i < need_build_modules.length; i++){
                var module_init_file = config.in_param.path + need_build_modules[i] + '/init.js';

                try{
                    var data = fs.readFileSync(module_init_file,'utf-8');
                }
                catch(e){
                    console.log('警告：没有找到' + need_build_modules[i] + '的启动文件（init.js）！');
                    need_build_modules[i] = '';
                    continue;
                }

                var dependent = [];
                try{
                    dependent = eval(data.match(/module\s*\.\s*requires\s*=\s*(\[.+\])/)[1]);
                }
                catch(e){}
                while(dependent.length){
                    var tmp_module_name = dependent.shift();
                    if(need_build_modules.indexOf(tmp_module_name)== -1){
                        need_build_modules.push(tmp_module_name);
                    }                        
                }
            }

            var tmp_array = [];
            for(var i=0; i < need_build_modules.length; i++){
                if(need_build_modules[i]){
                    tmp_array.push(need_build_modules[i]);
                }
            }
            console.log('依赖分析成功！');
            depend_modules = tmp_array;
            noopStream.push(null);
        });
    }
    return noopStream;
});

//清理js文件
gulp.task('cleanjs',function(){
    return gulp
    .src(['./.tmp/**/*.js','./build/**/*.js'])
    .pipe(clean());
});

//清理css文件
gulp.task('cleancss',function(){
    return gulp
    .src(['./.tmp/**/*.css','./build/**/*.css'])
    .pipe(clean());
});

//清理html文件
gulp.task('cleanhtml',function(){
    return gulp
    .src(['./.tmp/**/*.html','./build/**/*.html'])
    .pipe(clean());
});

//编译jade文件
gulp.task('jade',['cleanhtml','dev-analyze'],function(){
    var filesArr = [];
    for(var i = 0; i < depend_modules.length; i++){
        filesArr.push(build_config.in_param.path + depend_modules[i] + '/template/**/*.jade');
    }

    return gulp
    .src(filesArr)
    .pipe(jade())
    .pipe(gulp.dest('./.tmp/template'));
});

gulp.task('html2js',['jade'],function(){
    return gulp
    .src('./.tmp/template/*.html')
    .pipe(html2js({
      outputModuleName: 'mh.tpl',
      useStrict: true
    }))
    .pipe(concat('mh.tpl.js'))
    .pipe(gulp.dest('./.tmp/modules'));
});

//编译js
gulp.task('js', ['cleanjs','dev-analyze','html2js'],function() {
    var jsdest = gulp.dest('build');
    console.log('js合并与压缩开始！');

    //2.模块内文件拼合到.tmp
    var finishedCount = 0,
    modules = new mc_module(build_config.in_param.path);

    for(var i = 0; i< depend_modules.length ;i++){
        modules.concat(depend_modules[i],function(){
            finishedCount++;
            if(finishedCount == depend_modules.length){
                keep_go();
            }
        });
    }

    function keep_go(){
        //3.继续操作
        gulp
        .src('./.tmp/modules/*.js')
        .pipe(concat(build_config.out_param.js.filename + '.js'))
        .pipe(ngAnnotate())
        .pipe(uglify())
        .pipe(jsdest);
    };

    return jsdest;
});

//编译css文件
gulp.task('css',['cleancss','dev-analyze'],function(){
    var filesArr = [];
    for(var i = 0; i < depend_modules.length; i++){
        filesArr.push(build_config.in_param.path + depend_modules[i] + '/scss/**/*.scss');
    }

    gulp
    .src(filesArr)
    .pipe(sass.sync().on('error', sass.logError))
    .pipe(concat(build_config.out_param.css.filename + '.css'))
    .pipe(uglifycss())
    .pipe(gulp.dest('./build'));
});

gulp.task('build',['js','css']);  