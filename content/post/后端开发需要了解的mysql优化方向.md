Title: 后端开发需要了解的mysql优化方向
Date: 2018-05-08 18:34
Tags: 思维导图
Category: MySql
Slug: optimize-picture


#优化思维导图
![mysql优化思维导图](https://upload-images.jianshu.io/upload_images/10175660-dbeb71ebc3ad751b.jpg?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

#参数优化注意事项
参数优化分为 动态参数配置 和 配置文件的配置，建议在启动mysql之前配置好优化参数，这样将会全局有效，如使用动态参数配置可能会不生效或出现问题,并且如果数据库重启那么之前的优化参数都会失效
```
SHOW VARIABLES LIKE 'sort%'
修改会话级变量
set SESSION sort_buffer_size=720000
退出重新连接后，此参数恢复原值

修改全局变量 
set GLOBAL sort_buffer_size = 720000
```
#优化系列
[库级优化之SHOW GLOBAL STATUS](https://www.jianshu.com/p/bfc8aaa0b9f4)
