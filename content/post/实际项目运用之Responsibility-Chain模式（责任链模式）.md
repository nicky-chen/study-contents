---
title: 实际项目运用之Responsibility-Chain模式（责任链模式）
date: 2018-06-29T11:18:15+08:00
weight: 70
slug: responsibility-chain
tags: ["行为型"]
categories: ["design-pattern"]
author: "nicky_chin"
comments: true
share: true
draft: false
---



# 1 模式概要
### 1.1 简介
* 责任链模式为请求创建一个接收者对象链，每个接收者都包含对另一个接收者的引用，如果一个对象不能处理该请求，那么它会把请求传给下一个接收者，依此类推
* 责任链模式避免了请求的发送者和接收者耦合在一起，让多个对象都有可能接收请求，将这些对象连成一条链，并且沿着这条链传递请求，直到有对象处理它为止

### 1.2 责任链模式优缺点
**优点**
>降低耦合度。它将请求的发送者和接收者解耦
简化了对象，使得对象不需要知道链的结构
增强给对象指派职责的灵活性，允许动态地新增或者删除责任链
增加新的请求处理类方便

**缺点**
>不能保证请求一定被接收；
系统性能将受到一定影响，调试时不方便，可能会造成循环调用


# 2 模式结构

### 2.1 对象定义
*Handler（抽象处理者）*： 定义一个处理请求的接口，提供对后续处理者的引用
*ConcreteHandler（具体处理者）*： 抽象处理者的子类，处理用户请求，可选将请求处理掉还是传给下家；在具体处理者中可以访问链中下一个对象，以便请求的转发

### 2.2 类图及设计

![责任链](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510112242.png)

**代码详解：**

_抽象处理者_
```
public abstract class Handler {

	protected Handler nextHandler; // 下一个责任链成员

	public Handler getNextHandler() {
		return nextHandler;
	}

	public void setNextHandler(Handler nextHandler) {
		this.nextHandler = nextHandler;
	}

	// 处理传递过来的时间
	public abstract void handleMessage(int type);
}
```
_具体处理者_
在当前处理者对象无法处理时，将执行权传给下一个处理者对象
```
:::java
public class ConcreteHandler1 extends Handler {

	@Override
	public void handleMessage(int type) {
		if (type == 1 || type == 3) {
			System.out.println("ConcreteHandler1解决了问题！");
		} else {
			System.out.println("ConcreteHandler1解决不了问题......");
			if (nextHandler != null) {
				nextHandler.handleMessage(type);
			} else {
				System.out.println("没有人能处理这个消息");
			}
		}
	}
}

public class ConcreteHandler2 extends Handler {

	@Override
	public void handleMessage(int type) {
		if (type == 2 || type == 5) {
			System.out.println("ConcreteHandler2解决了问题！");
		} else {
			System.out.println("ConcreteHandler2解决不了问题......");
			if (nextHandler != null) {
				nextHandler.handleMessage(type);
			} else {
				System.out.println("没有人能处理这个消息");
			}
		}
	}
}

public class ConcreteHandler3 extends Handler {

	@Override
	public void handleMessage(int type) {
		if (type == 4 || type == 6) {
			System.out.println("ConcreteHandler3解决了问题！");
		} else {
			System.out.println("ConcreteHandler3解决不了问题......");
			if (nextHandler != null) {
				nextHandler.handleMessage(type);
			} else {
				System.out.println("没有人能处理这个消息");
			}
		}
	}
}
```
_Client_  客户端调用
```
	// 初始化责任链：handler1 -> handler2 -> handler3
		Handler handler1 = new ConcreteHandler1();
		Handler handler2 = new ConcreteHandler2();
		Handler handler3 = new ConcreteHandler3();
		handler2.setNextHandler(handler3);
		handler1.setNextHandler(handler2);
		// 处理事件
		System.out.println("--------------Message1");
		handler1.handleMessage(1);
		System.out.println("--------------Message2");
		handler1.handleMessage(2);
		System.out.println("--------------Message3");
		handler1.handleMessage(4);
		System.out.println("--------------Message4");
		handler1.handleMessage(7);
```
从上述模式可以知道，当我们需要多个`ifelse`做逻辑判断的时候，可以引入，从而提高代码可维护性

### 2.3 适用场景：
* 有多个对象可以处理同一个请求，具体哪个对象处理该请求由运行时刻自动确定
* 在不明确指定接收者的情况下，向多个对象中的某一个对象提交一个请求
* 可动态指定一组对象的处理请求

# 3 Spring中的过滤器

我们来分析Spring中Filter的**加载流程和执行流程**

### 3.1 初始化流程

初始化过滤器加载数据流如下：

![filter初始化加载时序图](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510112524.png)

_关键性代码_
```
public void onStartup(ServletContext servletContext) throws ServletException {
		Filter filter = getFilter();
		Assert.notNull(filter, "Filter must not be null");
		String name = getOrDeduceName(filter);
		if (!isEnabled()) {
			this.logger.info("Filter " + name + " was not registered (disabled)");
			return;
		}
        //增加过滤器,数据流向 HashMap<String, FilterDef> filterDefs
		FilterRegistration.Dynamic added = servletContext.addFilter(name, filter);
		if (added == null) {
			this.logger.info("Filter " + name + " was not registered "
					+ "(possibly already registered?)");
			return;
		}
                //配置过滤器注册信息
		configure(added);
	}

```
`configure()`方法主要关注
```
  if (isMatchAfter) {
                context.addFilterMap(filterMap);
            } else {
                context.addFilterMapBefore(filterMap);
            }
```
不管是数据走哪里，最终会通过 *System.arraycopy* 数组扩容，增加过滤器信息到  `private FilterMap[] array` 这个数组中。
最后调用StandardContext类中的 `filterStart()` 方法完成过滤器的初始化

### 3.2 执行过程
主要分两步，*创建过滤器责任链 和 执行责任链*

**3.2.1 创建过程**

创建filterChain方法主要在`ApplicationFilterFactory.createFilterChain(request, wrapper, servlet)` 中，部分代码讲解：

```
{
  // 获取过滤器上下文
        StandardContext context = (StandardContext) wrapper.getParent();
       //获取加载的过滤器列表
        FilterMap filterMaps[] = context.findFilterMaps();

        // If there are no filter mappings, we are done
        if ((filterMaps == null) || (filterMaps.length == 0))
            return (filterChain);

        //  获取匹配的过滤器映射信息
        DispatcherType dispatcher =
                (DispatcherType) request.getAttribute(Globals.DISPATCHER_TYPE_ATTR);

        String requestPath = null;
        Object attribute = request.getAttribute(Globals.DISPATCHER_REQUEST_PATH_ATTR);
        if (attribute != null){
            requestPath = attribute.toString();
        }

        String servletName = wrapper.getName();

        // 每个过滤器配置对应处理的请求路径信息
        for (int i = 0; i < filterMaps.length; i++) {
            if (!matchDispatcher(filterMaps[i] ,dispatcher)) {
                continue;
            }
            if (!matchFiltersURL(filterMaps[i], requestPath))
                continue;
            ApplicationFilterConfig filterConfig = (ApplicationFilterConfig)
                context.findFilterConfig(filterMaps[i].getFilterName());
            if (filterConfig == null) {
                // FIXME - log configuration problem
                continue;
            }
            filterChain.addFilter(filterConfig);
        }

        // 配置对应servletName信息，最后返回过滤器链
        for (int i = 0; i < filterMaps.length; i++) {
            if (!matchDispatcher(filterMaps[i] ,dispatcher)) {
                continue;
            }
            if (!matchFiltersServlet(filterMaps[i], servletName))
                continue;
            ApplicationFilterConfig filterConfig = (ApplicationFilterConfig)
                context.findFilterConfig(filterMaps[i].getFilterName());
            if (filterConfig == null) {
                // FIXME - log configuration problem
                continue;
            }
            filterChain.addFilter(filterConfig);
        }

        // Return the completed filter chain
        return filterChain;
}
```

在StandardWrapperValue类的`invoke()`方法中调用ApplicationFilterChai类的`createFilterChain()`方法
在ApplicationFilterChai类的`createFilterChain()`方法中调用ApplicationFilterChain类的`addFilter()`方法
在ApplicationFilterChain类的`addFilter()`方法中给ApplicationFilterConfig数组赋值

![生成调用链](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510112549.png)

**3.2.2 执行责任链**

调用ApplicationFilterChain的 `doFilter()` 方法中最后会调用一个`internalDoFilter()` 方法，目的就是执行ApplicationFilterChain中的全部过滤器，从代码中可以发现它调用了 `doFilter` ，而在 `doFilter` 又会调用`internalDoFilter ` 从而使所有Filter都得以调用

```
private void internalDoFilter(ServletRequest request,ServletResponse response) throws IOException, ServletException {

    // 如果存在下一个，继续调用下一个过滤器
    if (pos < n) {
        ApplicationFilterConfig filterConfig = filters[pos++];
        try {
            Filter filter = filterConfig.getFilter();

            if (request.isAsyncSupported() && "false".equalsIgnoreCase(
                    filterConfig.getFilterDef().getAsyncSupported())) {
                request.setAttribute(Globals.ASYNC_SUPPORTED_ATTR, Boolean.FALSE);
            }
            if( Globals.IS_SECURITY_ENABLED ) {
                final ServletRequest req = request;
                final ServletResponse res = response;
                Principal principal =
                    ((HttpServletRequest) req).getUserPrincipal();

                Object[] args = new Object[]{req, res, this};
                SecurityUtil.doAsPrivilege ("doFilter", filter, classType, args, principal);
            } else {
                // 此处调用Filter的doFilter()方法  / 而 doFilter 又会调用 internalDoFilter 直到调用完所有的过滤器
                filter.doFilter(request, response, this);
            }
        } catch (IOException | ServletException | RuntimeException e) {
            throw e;
        } catch (Throwable e) {
            e = ExceptionUtils.unwrapInvocationTargetException(e);
            ExceptionUtils.handleThrowable(e);
            throw new ServletException(sm.getString("filterChain.filter"), e);
        }
        return;
    }

    // 从最后一个开始调用
    try {
        if (ApplicationDispatcher.WRAP_SAME_OBJECT) {
            lastServicedRequest.set(request);
            lastServicedResponse.set(response);
        }

        if (request.isAsyncSupported() && !servletSupportsAsync) {
            request.setAttribute(Globals.ASYNC_SUPPORTED_ATTR,
                    Boolean.FALSE);
        }
        // 包装请求
        if ((request instanceof HttpServletRequest) &&
                (response instanceof HttpServletResponse) &&
                Globals.IS_SECURITY_ENABLED ) {
            final ServletRequest req = request;
            final ServletResponse res = response;
            Principal principal =
                ((HttpServletRequest) req).getUserPrincipal();
            Object[] args = new Object[]{req, res};
            SecurityUtil.doAsPrivilege("service", servlet, classTypeUsedInService,args, principal);
        } else {
            servlet.service(request, response);
        }
    } catch (IOException | ServletException | RuntimeException e) {
        throw e;
    } catch (Throwable e) {
        e = ExceptionUtils.unwrapInvocationTargetException(e);
        ExceptionUtils.handleThrowable(e);
        throw new ServletException(sm.getString("filterChain.servlet"), e);
    } finally {
        if (ApplicationDispatcher.WRAP_SAME_OBJECT) {
            lastServicedRequest.set(null);
            lastServicedResponse.set(null);
        }
    }
}
```
这样，一个完整的过滤器链就形成，然后进行调用

# 4 项目中的实际运用

**业务场景**

我们在项目中使用了阿里的MQ消息中间件，来加快请求的响应时间和异步解耦处理。RocktMQ主要可以按Topic来分区，然后按Tag分组，不同的业务区分不同的*tag*
比如：
`短信类的消息 messageTag`
`手机推送消息 pushTag`
`延时任务消息 delayTag`
`等等。。。`

**常规写法**
```
if(message.getTag() == messageTag){
 //doSomething
}else if(message.getTag() == pushTag){
 //doSomething
}else if (message.getTag() == delayTag){
 //doSomething
}
....
```
要是`ifelse`多了，最后会形成箭头代码，最后连自己都不知道逻辑了。所以我就想到了责任链模式，刚好符合我们的实际场景。

**具体设计方案如下：**

设计UML类图
![类图](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510112612.png)


*抽象公共监听器*，主要用到了单例模式获取常量
```
public abstract class AbstractCommonListener {

    private ParametersDO parametersDO;

    protected AbstractCommonListener() {
        //获取单例对象
        this.parametersDO = ParametersDO.getInstance();
    }

     public final String getAccessKey() {
        return parametersDO.getAccessKey();
    }

    public final String getSecretKey() {
        return  parametersDO.getSecretKey();
    }

    public final String getConsumerId() {
        return parametersDO.getConsumerId();
    }

    public final String getONSAddr() {
        return parametersDO.getONSAddr();
    }

    public final String getTopic() {
        return parametersDO.getTopic();
    }


}


class ParametersDO{

    private static volatile boolean initialize = false;

    private String accessKey;

    private String secretKey;

    private String consumerId;

    private String ONSAddr;

    private String topic;

    private ParametersDO() {

        synchronized (ParametersDO.class) {
            if (!initialize) {
                this.accessKey = BundleUtil.getResult("mq.accesskey");
                this.consumerId = BundleUtil.getResult("mq.public.consumer.id");
                this.ONSAddr = BundleUtil.getResult("mq.ons.addr");
                this.topic = BundleUtil.getResult("mq.public.topic");
                this.secretKey = BundleUtil.getResult("mq.secretkey");
                initialize = !initialize;
            } else {
                throw new RuntimeException("ParametersDO单例已被破坏");
            }

        }

    }

    static ParametersDO getInstance() {
        return ListenerHolder.INSTANCE;
    }

    private static class ListenerHolder{
        private static final ParametersDO INSTANCE = new ParametersDO();
    }


    final String getAccessKey() {
        return accessKey;
    }

    final String getSecretKey() {
        return secretKey;
    }

    final String getConsumerId() {
        return consumerId;
    }

    final String getONSAddr() {
        return ONSAddr;
    }

    final String getTopic() {
        return topic;
    }

}
```

*具体监听器*，监听器主要用于MQ监听消费Topic
```
public class GlobalOrderListener extends AbstractCommonListener implements MessageOrderListener {

    @Override
    public OrderAction consume(Message message, ConsumeOrderContext context) {

        //新增处理消费tag 只需添加Handler
        AbstractMessageHandler<OrderAction, Message> handler = HandlerFactory.getHandlerResponsibilityChain(
                        JpushOrderHandler.class,
                        DelayRemoveOrderHandler.class);
        return handler.handleMessage(message);
    }
}
```
正常情况下，我们会在`consume()`方法中区分tag来做不同业务的数据处理


*抽象处理者*
```
/**
 * @author nicky_chin [shuilianpiying@163.com]
 * @since --created on 2018/6/26 at 14:42
 * 责任链抽象类
 */
public abstract class AbstractMessageHandler<T, R> extends AbstractCommonListener {

    /**
     * 下一个责任链成员
     */
    protected AbstractMessageHandler<T, R> nextHandler;

    public AbstractMessageHandler getNextHandler() {
        return nextHandler;
    }

    public void setNextHandler(AbstractMessageHandler<T, R> nextHandler) {
        this.nextHandler = nextHandler;
    }

    /**
     * 处理传递过来的tag
     * @param message 表达式
     * @return T
     */
    public abstract T handleMessage(R message);

}
```
*具体处理者* :推送消息Handler
```
@Slf4j
public class JpushOrderHandler extends AbstractMessageHandler<OrderAction, Message> {

    @Override
    public OrderAction handleMessage(Message message) {
        String tagList = BundleUtil.getResult("mq.tag");
        String[] tags = tagList.split(",");
        if (message.getTopic().equals(getTopic()) && Arrays.asList(tags).contains(message.getTag())) {  //避免消费到其他消息 json转换报错
            log.info(" 监听到推送消息,[topic:" + message.getTopic() + "], [tag:" + message.getTag() + "]。开始解析...");
            try {
                // res 是生产者传过来的消息内容
                byte[] body = message.getBody();
                String res = new String(body);
                String substring = res.substring(res.length() -1, res.length());
                PushInfo info = JSON.parseObject(res.substring(0, res.length() - 1), PushInfo.class);
  
                if ("1".equals(substring)){
                    // 分组推送
                    CommonUtil.Jpush2SingleUserMq(info,true);
                 }else {
                 //  多个用户推送
                    CommonUtil.Jpush2SingleUserMq(info,false);
                }
                return OrderAction.Success;
            }catch (Exception e) {
                log.error("MessageListener.consume error:" + e.getMessage(), e);
                return OrderAction.Suspend;
            }
        } else {
           if (nextHandler == null) {
               log.info("未匹配到topic:{}, tag:{}跳过,",message.getTopic(), message.getTag());
               return OrderAction.Success;
           }
           return nextHandler.handleMessage(message);
       }
    }
}
```

*具体处理者* :延时订单处理Handler 
```
@Slf4j
public class DelayRemoveOrderHandler extends AbstractMessageHandler<OrderAction, Message> {

    private static Lock lock = new ReentrantLock(true);

    @Override
    public OrderAction handleMessage(Message message) {
        //消费延时订单tag
        if (message.getTopic().equals(getTopic()) && message.getTag().equals(CommonConstants.TAG)) {
            log.info(" 监听订单删除消息,[topic:" + message.getTopic() + "], [tag:" + message.getTag() + "]。开始解析...");
            //userId + UNDER_BAR + borrowOrderId
            try {
                String content = new String(message.getBody(), Charsets.UTF_8);
                log.info("消费内容 userId_borrowOrderId :{}", content);
                if (StringUtils.isEmpty(content)) {
                    return OrderAction.Success;
                }
                String[] info = content.split(CommonConstants.UNDER_BAR);
                String userId = info[0];
                String key = CommonConstants.CART_ID_LIST + userId;

                lock.tryLock(3, TimeUnit.SECONDS);
                //查询用户购物车列表
                String orders = RedisUtil.getString(key);
                if (StringUtils.isEmpty(orders)) {
                    return OrderAction.Success;
                }
                List<Integer> orderList = JSONObject.parseArray(orders, Integer.class);
                List<Integer> delList;
                String idStr = info[1];
                //判断是否是批量加入
                if (idStr.startsWith(CommonConstants.LIST_MARK)) {
                    String[] s = content.split(CommonConstants.LIST_MARK);
                    delList = JSONObject.parseArray(s[1], Integer.class);
                } else {
                    delList = Collections.singletonList(Integer.valueOf(info[1]));
                }
                orderList.removeAll(delList);
                RedisUtil.setString(key, GsonUtil.objectConvertJson(orderList));
                log.info("删除用户:{},延时订单:{},成功", userId, delList.toString());
                return OrderAction.Success;
            } catch (Exception e) {
                //消费失败，挂起当前队列
                log.error("延时订单:{}消费异常", new String(message.getBody(), Charsets.UTF_8));
                return OrderAction.Suspend;
            } finally {
                lock.unlock();
            }

        } else {
            if (nextHandler == null) {
                log.info("未匹配到topic:{}, tag:{}跳过,",message.getTopic(), message.getTag());
                return OrderAction.Success;
            }
           return nextHandler.handleMessage(message);
        }
    }
}
```

*模式工厂* HandlerFactory 
```
public final class HandlerFactory {

    private static TypeConverterManager typeConverterManager = JoddBean.get().typeConverterManager();


    public static  <T, R>AbstractMessageHandler newJpushOrderHandler(){
        return new JpushOrderHandler();
    };

    public static <T, R>AbstractMessageHandler newDelayRemoveOrderHandler(){
        return new DelayRemoveOrderHandler();
    }

    /**
     * 责任链模式
     */
    @SafeVarargs
    public static <T, R>AbstractMessageHandler<T, R> getHandlerResponsibilityChain(Class< ? extends AbstractMessageHandler<T, R>> ... handlers ) {

        Preconditions.checkNotNull(handlers, "handler列表不能为空");
        if (handlers.length == CommonConstants.TRUE) {
            return BeanUtils.instantiate(handlers[CommonConstants.FIRST_ELEMENT]);
        }
        List<Object> list = Arrays.stream(handlers).map(BeanUtils::instantiate).collect(Collectors.toList());
        AbstractMessageHandler<T, R> result = null;
        for (int i = 1; i < list.size(); i++) {
            AbstractMessageHandler<T, R> pre = typeConverterManager.convertType(list.get(i - 1), handlers[i - 1]);
            AbstractMessageHandler<T, R> cur = typeConverterManager.convertType(list.get(i), handlers[i]);
            cur.setNextHandler(pre);
            result = cur;
        }
        return result;
    }
}
```
`getHandlerResponsibilityChain()` 主要是创建责任链，动态生成自己想要的逻辑责任链


客户端调用
```
public class RoborderConsumerAdapter{

    private OrderConsumer orderConsumer;

    public RoborderConsumerAdapter(OrderConsumer orderConsumer) {
        Assert.notNull(orderConsumer, "orderConsumer is null");
        this.orderConsumer = orderConsumer;
    }

    /**
     * 消费
     */
    public void consumerMessages(){
        AbstractCommonListener listener = BeanUtils.instantiate(GlobalOrderListener.class);
        this.orderConsumer.subscribe(listener.getTopic(), "*", (MessageOrderListener) listener);
    }

}

```
按这种设计方式，如果有一个新的业务处理场景，只需添加新的一个Handler实现抽象处理者就好，然后调用`getHandlerResponsibilityChain()`的时候，加入想要使用的Handler，就能处理，这样不会导致多人维护代码时，出现逻辑混乱问题，业务直接解耦，减少开发和维护成本

# Reference
[《JAVA与模式》之责任链模式](https://www.cnblogs.com/java-my-life/archive/2012/05/28/2516865.html)
