
---
title: 浅析java-nio及netty的reactor模型
date: 2020-06-11T12:39:09+08:00
weight: 70
slug: net-nio-netty
tags: ["netty"]
categories: ["网络"]
author: "nicky_chin"
comments: true
share: true
draft: false
---

# 1 服务端处理网络请求
首先看看服务端处理网络请求的典型过程：

![request-process](/media/net-nio-netty/preview.jpg)
由上图可以看到，主要处理步骤包括： 

获取请求数据，客户端与服务器建立连接发出请求，服务器接受请求（1-3）。

构建响应，当服务器接收完请求，并在用户空间处理客户端的请求，直到构建响应完成（4）。

返回数据，服务器将已构建好的响应再通过内核空间的网络 I/O 发还给客户端（5-7）。

设计服务端并发模型时，主要有如下两个关键点： 

服务器如何管理连接，获取输入数据。

服务器如何处理请求。


# 2 Reactor 模式

## 2.1基本设计思想

![request-reactor](/media/net-nio-netty/reactor-base.jpeg)

Reactor 模式，是指通过一个或多个输入同时传递给服务处理器的服务请求的事件驱动处理模式。 

服务端程序处理传入多路请求，并将它们同步分派给请求对应的处理线程，Reactor 模式也叫 Dispatcher 模式。

即 I/O 多了复用统一监听事件，收到事件后分发(Dispatch 给某进程)，是编写高性能网络服务器的必备技术之一。

Reactor 模式中有 2 个关键组成：

Reactor，Reactor 在一个单独的线程中运行，负责监听和分发事件，分发给适当的处理程序来对 IO 事件做出反应。 它就像公司的电话接线员，它接听来自客户的电话并将线路转移到适当的联系人。

Handlers，处理程序执行 I/O 事件要完成的实际事件，类似于客户想要与之交谈的公司中的实际官员。Reactor 通过调度适当的处理程序来响应 I/O 事件，处理程序执行非阻塞操作。

> 根据 Reactor 的数量和处理资源池线程的数量不同，有 3 种典型的实现：
>
> 单 Reactor 单线程
>
> 单 Reactor 多线程
>
> 主从 Reactor 多线程

## 2.2 主从 Reactor 多线程

![sub-reactor](/media/net-nio-netty/sub-reactor.jpeg)

> Reactor 主线程 MainReactor 对象通过 Select 监控建立连接事件，收到事件后通过 Acceptor 接收，处理建立连接事件。

> Acceptor 处理建立连接事件后，MainReactor 将连接分配 Reactor 子线程给 SubReactor 进行处理。

> SubReactor 将连接加入连接队列进行监听，并创建一个 Handler 用于处理各种连接事件。

> 当有新的事件发生时，SubReactor 会调用连接对应的 Handler 进行响应。

> Handler 通过 Read 读取数据后，会分发给后面的 Worker 线程池进行业务处理。

> Worker 线程池会分配独立的线程完成真正的业务处理，如何将响应结果发给 Handler 进行处理。

> Handler 收到响应结果后通过 Send 将响应结果返回给 Client。


## 2.3 netty中的运用

![netty-reactor](/media/net-nio-netty/netty-process.png)


* Server 端包含 1 个 Boss NioEventLoopGroup 和 1 个 Worker NioEventLoopGroup。

NioEventLoopGroup 相当于 1 个事件循环组，这个组里包含多个事件循环 NioEventLoop，每个 NioEventLoop 包含 1 个 Selector 和 1 个事件循环线程。

* 每个 Boss NioEventLoop 循环执行的任务包含 3 步：

1）轮询 Accept 事件；
2）处理 Accept I/O 事件，与 Client 建立连接，生成 NioSocketChannel，并将 NioSocketChannel 注册到某个 Worker NioEventLoop 的 Selector 上；
3）处理任务队列中的任务，runAllTasks。任务队列中的任务包括用户调用 eventloop.execute 或 schedule 执行的任务，或者其他线程提交到该 eventloop 的任务。

* 每个 Worker NioEventLoop 循环执行的任务包含 3 步：

1）轮询 Read、Write 事件；
2）处理 I/O 事件，即 Read、Write 事件，在 NioSocketChannel 可读、可写事件发生时进行处理；
3）处理任务队列中的任务，runAllTasks。

netty 在线程池并没有完全遵从父子的reactor模型