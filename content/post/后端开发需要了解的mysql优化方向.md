
---
title: 后端开发需要了解的mysql优化方向
date: 2017-06-13T11:18:15+08:00
weight: 70
slug: optimize-picture
tags: ["思维导图"]
categories: ["MySql"]
author: "nicky_chin"
comments: true
share: true
draft: false
---


#优化思维导图
![mysql优化思维导图](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510111253.png)

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
[库级优化之SHOW GLOBAL STATUS](https://nicky-chen.github.io/2017/09/12/show-global-status/)
