

---
title: 实际项目运用之State模式（状态模式）
date: 2018-12-19T11:18:15+08:00
weight: 70
slug: state-machine
tags: ["行为型"]
categories: ["design-pattern"]
author: "nicky_chin"
comments: true
share: true
draft: false
---



# 1	模式简介
**定义：**
状态模式允许对象在内部状态改变时改变它的行为，对象看起来好像修改了它的类。这个模式将状态封装成独立的类，并将动作委托到代表当前状态的类的对象

**状态模式的优点：**
>封装了转换规则
枚举可能的状态，在枚举状态之前需要确定状态种类
将所有与某个状态有关的行为放到一个类中，可方便增加新的状态
允许状态转换逻辑与状态对象合成一体，而非复杂条件语句块
可以让多个环境对象共享一个状态对象，从而减少系统中对象的个数

**状态模式的缺点：**
>增加系统类和对象的个数
结构与实现都较为复杂，如果使用不当将导致程序结构和代码的混乱
对"开闭原则"的支持不太好，增加新状态类需在状态类上增加行为方法

**状态模式的适用场景：**
 1. 对象的行为依赖于它的状态，并且可以在运行时根据状态改变行为。
 2. 代码中包含大量与对象状态有关的if/else语句
 3. 接口幂等要求

**状态模式和策略模式：**
相同点是它们都需要根据需求选择相应的状态或策略
不同点是状态模式是在一个类中通过不同的动作切换不同的状态，而策略模式是为一个类选择某个策略，即状态模式中的Context是和多个状态关联的，而策略模式中的Context只和一个策略关联

**状态模式角色介绍：**
![状态模式类图](https://upload-images.jianshu.io/upload_images/10175660-113c92a20076e368.jpg?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

（1）Context类，依赖倒置原则，通过适配器模式维护状态类
（2）State：抽象状态类或状态接口，用以抽象封装行为
（3）ConcreteState类：具体状态类，实现了State中的抽象方法

------------------------------


# 2 实际运用

借贷平台的订单，有*审核-发布-抢单 等等* 步骤，随着操作的不同，会改变订单的状态，通常通过if/else判断订单的状态，从而实现不同的逻辑，伪代码如下：
```
if(审核){
   //审核逻辑
}elseif(发布){
   //发布逻辑
}elseif(接单){
   //接单逻辑
}
```
上述解决方案缺点非常明显：这类代码难以应对变化，在添加一种状态时，我们需要手动添加if/else，在添加一种功能时，要对所有的状态进行判断。因此代码会变得越来越臃肿，并且一旦没有处理某个状态，便会发生极其严重的BUG，难以维护

### 2.1 状态模式应用

状态模式本质上是一种基于状态和事件的 _状态机_ ,下面是订单流程的状态图

![订单流程](https://upload-images.jianshu.io/upload_images/10175660-b6ccaa815dbe7c7b.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

通过状态图，我们再设计一张横纵坐标关系表来比较，图如下：

![关系表](https://upload-images.jianshu.io/upload_images/10175660-bb5334e225393713.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

通过上述表 我们可以细化为一个二维数组，来表示状态与事件直接的关系：

![二维数组](https://upload-images.jianshu.io/upload_images/10175660-39476dcf8ce242e4.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)


### 2.2 代码实现

我们通过状态的各种图例分析来用代码实现逻辑

**状态枚举类**
```
public enum StateEnum {

    //订单生成
    GENERATE(1, "GENERATE"),

    //已审核
    REVIEWED(2, "REVIEWED"),

    //已发布
    PUBLISHED(3, "PUBLISHED"),

    //待付款
    NOT_PAY(4, "NOT_PAY"),

    //已付款
    PAID(5, "PAID"),

    //已完结
    FEED_BACKED(6, "FEED_BACKED");

    private int key;
    private String value;

    StateEnum(int key, String value) {
        this.key = key;
        this.value = value;
    }
    public int getKey() {return key;}
    public String getValue() {return value;}

}
```
**状态接口**
```
public interface State {

    /**
     * 电审
     */
    void checkEvent(Context context);

    /**
     * 电审失败
     */
    void checkFailEvent(Context context);

    /**
     * 定价发布
     */
    void makePriceEvent(Context context);

    /**
     * 接单
     */
    void acceptOrderEvent(Context context);

    /**
     * 无人接单失效
     */
    void notPeopleAcceptEvent(Context context);

    /**
     * 付款
     */
    void payOrderEvent(Context context);

    /**
     * 接单有人支付失效
     */
    void orderFailureEvent(Context context);

    /**
     * 反馈
     */
    void feedBackEvent(Context context);


    String getCurrentState();

}
```

**抽象状态类**
```
public abstract class AbstractState implements State {

    protected static final RuntimeException EXCEPTION = new RuntimeException("操作流程不允许");

    @Override
    public void checkEvent(Context context) {
        throw EXCEPTION;
    }

    @Override
    public void checkFailEvent(Context context) {
        throw EXCEPTION;
    }

    @Override
    public void makePriceEvent(Context context) {
        throw EXCEPTION;
    }

    @Override
    public void acceptOrderEvent(Context context) {
        throw EXCEPTION;
    }

    @Override
    public void notPeopleAcceptEvent(Context context) {
        throw EXCEPTION;
    }

    @Override
    public void payOrderEvent(Context context) {
        throw EXCEPTION;
    }

    @Override
    public void orderFailureEvent(Context context) {
        throw EXCEPTION;
    }

    @Override
    public void feedBackEvent(Context context) {
        throw EXCEPTION;
    }
}
```

**具体状态类**

```
public class FeedBackState extends AbstractState{

    @Override
    public String getCurrentState() {
        return StateEnum.FEED_BACKED.getValue();
    }
}

public class GenerateState extends AbstractState {

    @Override
    public void checkEvent(Context context) {
        context.setState(new ReviewState());
    }

    @Override
    public void checkFailEvent(Context context) {
        context.setState(new FeedBackState());
    }

    @Override
    public String getCurrentState() {
        return StateEnum.GENERATE.getValue();
    }
}

public class NotPayState extends AbstractState{


    @Override
    public void payOrderEvent(Context context) {
        context.setState(new PaidState());
    }

    @Override
    public void feedBackEvent(Context context) {
        context.setState(new FeedBackState());
    }

    @Override
    public String getCurrentState() {
        return StateEnum.NOT_PAY.getValue();
    }
}

public class PaidState extends AbstractState {

    @Override
    public void feedBackEvent(Context context) {
        context.setState(new FeedBackState());
    }

    @Override
    public String getCurrentState() {
        return StateEnum.PAID.getValue();
    }
}

public class PublishState extends AbstractState {

    @Override
    public void acceptOrderEvent(Context context) {
        context.setState(new NotPayState());
    }

    @Override
    public void notPeopleAcceptEvent(Context context) {
        context.setState(new FeedBackState());
    }

    @Override
    public String getCurrentState() {
        return StateEnum.PUBLISHED.getValue();
    }
}

public class ReviewState extends AbstractState {


    @Override
    public void makePriceEvent(Context context) {
        context.setState(new PublishState());
    }

    @Override
    public String getCurrentState() {
        return StateEnum.REVIEWED.getValue();
    }
    
}
```

**环境上下文**
```
public class Context extends AbstractState {

    private State state;

    @Override
    public void checkEvent(Context context) {
        state.checkEvent(this);
        getCurrentState();
    }

    @Override
    public void checkFailEvent(Context context) {
        state.checkFailEvent(this);
        getCurrentState();
    }

    @Override
    public void makePriceEvent(Context context) {
        state.makePriceEvent(this);
        getCurrentState();
    }

    @Override
    public void acceptOrderEvent(Context context) {
        state.acceptOrderEvent(this);
        getCurrentState();
    }

    @Override
    public void notPeopleAcceptEvent(Context context) {
        state.notPeopleAcceptEvent(this);
        getCurrentState();
    }

    @Override
    public void payOrderEvent(Context context) {
        state.payOrderEvent(this);
        getCurrentState();
    }

    @Override
    public void orderFailureEvent(Context context) {
        state.orderFailureEvent(this);
        getCurrentState();
    }

    @Override
    public void feedBackEvent(Context context) {
        state.feedBackEvent(this);
        getCurrentState();
    }

    public State getState() {
        return state;
    }

    public void setState(State state) {
        this.state = state;
    }

    @Override
    public String getCurrentState() {
        System.out.println("当前状态 : " + state.getCurrentState());
        return state.getCurrentState();
    }
```

客户端调用
```
public class Client {

    public static void main(String[] args) {
        Context context = new Context();
        context.setState(new PublishState());
        //publish --> not pay
        context.acceptOrderEvent(context);
        //not pay --> paid
        context.payOrderEvent(context);
        // 失败
        context.checkFailEvent(context);
    }

}
```
控制台打印如下:
```
当前状态 : NOT_PAY
当前状态 : PAID
Exception in thread "main" java.lang.RuntimeException: 操作流程不允许
	at com.nicky.state.AbstractState.<clinit>(AbstractState.java:9)
	at com.nicky.state.Client.main(Client.java:10)
```
订单状态从发布状态到 _已接单 -已付款_ 状态后，不能进行**电审失败事件**的操作，因为代码中如果某个行为不会触发状态的变化，会抛出一个 `RuntimeException` 异常，所以直接抛出异常

上述是实际项目中使用状态模式代码的简化版，之后我们用**Spring StateMachine** 让状态机结构更加层次化，可以帮助开发者简化状态机的开发过程




# 3 Spring状态机优化
创建一个Spring Boot的基础工程，并在pom.xml中加入`spring-statemachine-core`的依赖，具体如下：
```
<dependency>
		<groupId>org.springframework.statemachine</groupId>
		<artifactId>spring-statemachine-core</artifactId>
		<version>1.2.0.RELEASE</version>
	</dependency>
```

定义一个状态枚举
```
public enum OrderStatusEnum {

    //订单生成
    GENERATE,

    //已审核
    REVIEWED,

    //已发布
    PUBLISHED,

    //待付款
    NOT_PAY,

    //已付款
    PAID,

    //已完结
    FEED_BACKED;

    public static EnumMap<OrderStatusEnum, String> getMap() {
        EnumMap<OrderStatusEnum, String> map = new EnumMap<>(OrderStatusEnum.class);
        Arrays.stream(OrderStatusEnum.values()).forEach(x -> map.put(x, x.name()));
        return map;
    }
}
```

定义事件枚举
```
public enum OrderEventEnum {
    /**
     * 电审
     */
    CHECK,

    /**
     * 电审失败:
     */
    CHECK_FAIL,

    /**
     * 定价发布
     */
    MAKE_PRICE,

    /**
     * 接单
     */
    ACCEPT_ORDER,

    /**
     * 无人接单失效
     */
    NOT_PEOPLE_ACCEPT,

    /**
     * 付款
     */
    PAY_ORDER,

    /**
     * 接单有人支付失效
     */
    ORDER_FAILURE,

    /**
     * 反馈
     */
    FEED_BACK;

}
```

创建状态机配置类：
```
@Configuration
@EnableStateMachine
public class StateMachineConfig extends EnumStateMachineConfigurerAdapter<OrderStatusEnum, OrderEventEnum> {

    /**
     * 我们需要初始化状态机的状态。其中，initial(OrderStatusEnum.UNCONNECTED) 定义了初始状态是未连接状态
     * 。states(EnumSet.allOf(OrderStatusEnum.class)) 定义了状态机中存在的所有状态。
     */
    @Override
    public void configure(StateMachineStateConfigurer<OrderStatusEnum, OrderEventEnum> states) throws Exception {
        states.withStates()
                // 定义初始状态
                .initial(OrderStatusEnum.GENERATE)
                // 定义状态机状态
                .states(EnumSet.allOf(OrderStatusEnum.class));
    }


    /**
     * 我们需要初始化当前状态机有哪些状态事件。其中， source 指定原始状态，target 指定目标状态，event 指定触发事件。
     */
    @Override
    public void configure(StateMachineTransitionConfigurer<OrderStatusEnum, OrderEventEnum> transitions)
            throws Exception {

        transitions.withExternal()
                // 1.电审事件
                // 订单生成 -> 已审核
                .source(OrderStatusEnum.GENERATE)
                .target(OrderStatusEnum.REVIEWED)
                .event(OrderEventEnum.CHECK)
                .and()
                // 订单生成 -> 已完结
                .withExternal()
                .source(OrderStatusEnum.GENERATE)
                .target(OrderStatusEnum.FEED_BACKED)
                .event(OrderEventEnum.CHECK_FAIL)
                .and()

                // 2.定价发布事件
                // 已审核 -> 已发布
                .withExternal()
                .source(OrderStatusEnum.REVIEWED)
                .target(OrderStatusEnum.PUBLISHED)
                .event(OrderEventEnum.MAKE_PRICE)
                .and()

                // 3.接单事件
                .withExternal()
                // 已发布 -> 待付款
                .source(OrderStatusEnum.PUBLISHED)
                .target(OrderStatusEnum.NOT_PAY)
                .event(OrderEventEnum.ACCEPT_ORDER)
                .and()
                // 已发布 -> 已完结 2小时失效事件
                .withExternal()
                .source(OrderStatusEnum.PUBLISHED)
                .target(OrderStatusEnum.FEED_BACKED)
                .event(OrderEventEnum.NOT_PEOPLE_ACCEPT)
                .and()

                // 4.付款事件
                // 待付款 -> 已付款
                .withExternal()
                .source(OrderStatusEnum.NOT_PAY)
                .target(OrderStatusEnum.PAID)
                .event(OrderEventEnum.PAY_ORDER)
                .and()

                // 5.付款失效事件
                // 待付款 -> 已完结
                .withExternal()
                .source(OrderStatusEnum.NOT_PAY)
                .target(OrderStatusEnum.FEED_BACKED)
                .event(OrderEventEnum.ORDER_FAILURE)
                .and()

                //6.反馈事件
                // 已付款 -> 已完结
                .withExternal()
                .source(OrderStatusEnum.PAID)
                .target(OrderStatusEnum.FEED_BACKED)
                .event(OrderEventEnum.FEED_BACK);

    }


    //    @Override
//    public void configure(StateMachineConfigurationConfigurer<OrderStatusEnum, OrderEventEnum> config)
//            throws Exception {
//        config.withConfiguration()
//                .listener(listener());	// 指定状态机的处理监听器
//    }

//    @Bean
//    public StateMachineListener<OrderStatusEnum, OrderEventEnum> listener() {
//        return new StateMachineListenerAdapter<OrderStatusEnum, OrderEventEnum>() {
//
//            @Override
//            public void transition(Transition<OrderStatusEnum, OrderEventEnum> transition) {
//                if(transition.getTarget().getId() == OrderStatusEnum.PUBLISHED) {
//                    //todo
//                    return;
//                }
//            }
//
//        };
//    }

}
```
上述配置类中，我们通过重写`configure(StateMachineStateConfigurer<States, Events> states)方法`用来初始化当前状态机拥有哪些状态，其中，`initial(RegStatusEnum.GENERATE) `定义了初始状态为订单生成状态。`states(EnumSet.allOf(RegStatusEnum.class)) `定义了状态机中存在的所有状态。

而`configure(StateMachineTransitionConfigurer<States, Events> transitions)方法`是用来初始化当前状态机有哪些状态迁移动作，其中命名中我们很容易理解每一个迁移动作，都有来源状态  _source_ ，目标状态 _target_ 以及触发事件 _event_


状态监听器配置
```
@WithStateMachine
public class StateMachineEventConfig {

   // Spring StateMachine 提供了注解配置实现方式，所有 StateMachineListener
    // 接口中定义的事件都能通过注解的方式来进行配置实现。这里以连接事件为案例，
    // @OnTransition 中 source 指定原始状态，target 指定目标状态，当事件触发时将会被监听到从而调用 connect() 方法。

    private final Logger logger = LoggerFactory.getLogger(getClass());


    @OnTransition(source = "GENERATE", target = "REVIEWED")
    public void checkEvent(){
        logger.warn("---------电审事件---------");
        logger.info("订单生成 ------> 已审核");
    }

    @OnTransition(source = "GENERATE", target = "FEED_BACKED")
    public void checkFailEvent(){
        logger.warn("---------电审失败---------");
        logger.info("订单生成 ------> 已完结");
    }

    @OnTransition(source = "REVIEWED", target = "PUBLISHED")
    public void makePriceEvent(){
        logger.warn("--------定价发布----------");
        logger.info("已审核 -------> 已发布");
    }


    @OnTransition(source = "PUBLISHED", target = "NOT_PAY")
    public void acceptOrderEvent(){
        logger.warn("--------接单时间----------");
        logger.info("已发布 ------> 待付款");
    }

    @OnTransition(source = "PUBLISHED", target = "FEED_BACKED")
    public void notPeopleAcceptEvent(){
        logger.warn("---------无人接单失效---------");
        logger.info("已发布 -------> 已完结");
    }

    @OnTransition(source = "NOT_PAY", target = "PAID")
    public void payOrderEvent(){
        logger.warn("--------付款事件----------");
        logger.info("待付款 --------> 已付款");
    }

    @OnTransition(source = "NOT_PAY", target = "FEED_BACKED")
    public void orderFailureEvent(){
        logger.warn("--------接单有人支付失效----------");
        logger.info("待付款 ------> 已完结");
    }

    @OnTransition(source = "PAID", target = "FEED_BACKED")
    public void feedBackEvent(){
        logger.warn("--------反馈事件----------");
        logger.info("已付款 -------> 已完结");
    }

}
```

_Spring StateMachine_ 提供了注解配置实现方式，所有 `StateMachineListener` 接口中定义的事件都能通过注解的方式来进行配置实现。**@OnTransition** 中 source 指定原始状态，target 指定目标状态，当事件触发时会调用相应的方法

状态机句柄
```
public class PersistStateMachineHandler extends LifecycleObjectSupport {

    private final StateMachine<OrderStatusEnum, OrderEventEnum> stateMachine;
    private final PersistingStateChangeInterceptor interceptor = new PersistingStateChangeInterceptor();
    private final CompositePersistStateChangeListener listeners = new CompositePersistStateChangeListener();


    /**
     * 实例化一个新的持久化状态机Handler
     * @param stateMachine 状态机实例
     */
    public PersistStateMachineHandler(StateMachine<OrderStatusEnum, OrderEventEnum> stateMachine) {
        Assert.notNull(stateMachine, "State machine must be set");
        this.stateMachine = stateMachine;
    }

    @Override
    protected void onInit() throws Exception{
        stateMachine.getStateMachineAccessor().doWithAllRegions(function -> function.addStateMachineInterceptor(interceptor));
    }


    /**
     * 处理entity的事件
     * @return 如果事件被接受处理，返回true
     */
    public boolean handleEventWithState(Message<OrderEventEnum> event, OrderStatusEnum state) {
        stateMachine.stop();
        List<StateMachineAccess<OrderStatusEnum, OrderEventEnum>> withAllRegions = stateMachine.getStateMachineAccessor()
                .withAllRegions();
        for (StateMachineAccess<OrderStatusEnum, OrderEventEnum> a : withAllRegions) {
            a.resetStateMachine(new DefaultStateMachineContext<>(state, null, null, null));
        }
        stateMachine.start();
        return stateMachine.sendEvent(event);
    }

    /**
     * 添加listener
     *
     * @param listener the listener
     */
    public void addPersistStateChangeListener(PersistStateChangeListener listener) {
        listeners.register(listener);
    }

    private class PersistingStateChangeInterceptor extends StateMachineInterceptorAdapter<OrderStatusEnum, OrderEventEnum> {

        // 状态预处理的拦截器方法
        @Override
        public void preStateChange(State<OrderStatusEnum, OrderEventEnum> state, Message<OrderEventEnum> message,
                                   Transition<OrderStatusEnum, OrderEventEnum> transition, StateMachine<OrderStatusEnum, OrderEventEnum> stateMachine) {
            listeners.onPersist(state, message, transition, stateMachine);
        }
    }

    private class CompositePersistStateChangeListener extends AbstractCompositeListener<PersistStateChangeListener> implements PersistStateChangeListener {
        @Override
        public void onPersist(State<OrderStatusEnum, OrderEventEnum> state, Message<OrderEventEnum> message,
                              Transition<OrderStatusEnum, OrderEventEnum> transition, StateMachine<OrderStatusEnum, OrderEventEnum> stateMachine) {
            for (Iterator<PersistStateChangeListener> iterator = getListeners().reverse(); iterator.hasNext(); ) {
                PersistStateChangeListener listener = iterator.next();
                listener.onPersist(state, message, transition, stateMachine);
            }
        }
    }
}
```
事件监听器接口
```
public interface PersistStateChangeListener {

        /**
         * 当状态被持久化，调用此方法
         * @param stateMachine 状态机实例
         */
        void onPersist(State<OrderStatusEnum, OrderEventEnum> state, Message<OrderEventEnum> message,
                Transition<OrderStatusEnum, OrderEventEnum> transition, StateMachine<OrderStatusEnum, OrderEventEnum>stateMachine);
    }

@Configuration
public class OrderPersistHandlerConfig {

	
    @Autowired
    private StateMachine<OrderStatusEnum, OrderEventEnum> orderStateMachine;

    @Bean
    public PersistStateMachineHandler persistStateMachineHandler() {
        return new PersistStateMachineHandler(orderStateMachine);
    }


}
```

 具体监听器   
```
@Component("orderPersistStateChangeListener")
public class OrderPersistStateChangeListener implements PersistStateChangeListener {

    @Autowired
    private UserDao userDao;

	@Override
	public void onPersist(State<OrderStatusEnum, OrderEventEnum> state, Message<OrderEventEnum> message,
			Transition<OrderStatusEnum, OrderEventEnum> transition,
			StateMachine<OrderStatusEnum, OrderEventEnum> stateMachine) {
		if (message != null && message.getHeaders().containsKey("order")) {
            Integer order = message.getHeaders().get("order", Integer.class);
            User user = userDao.getById(order);
            OrderStatusEnum status = state.getId();
            System.out.println("处理订单");
            System.err.println(state);
        }
	}
}
```

业务层
```
public class UserServiceImpl implements UserService {

    @Autowired
    private UserDao userDao;

    @Autowired
    private OrderRepo repo;

    @Resource(name="orderPersistStateChangeListener")
    private OrderPersistStateChangeListener orderPersistStateChangeListener;

    @Resource(name="persistStateMachineHandler")
    private PersistStateMachineHandler persistStateMachineHandler;


    @PostConstruct
    private void initialize() {
        this.persistStateMachineHandler.addPersistStateChangeListener(orderPersistStateChangeListener);
    }

    @Override
    public List<User> likeName(final String name) throws UserNotFoundException {

        if (name == null || name.trim().isEmpty()) {
            throw new UserNotFoundException("姓名不能为空");
        }
        List<User> list = userDao.likeName(name);

        if(CollectionUtils.isEmpty(list)){
            throw new RepositoryException("未找到数据");
        }

        return list;
    }

    @Transactional(readOnly=false)
    @Override
    public boolean change(int order, OrderEventEnum event) {
        Order o = repo.findByOrderId(order);
        if (o == null) {
            o = new Order();
            o.setOrderId(1);
            o.setStatus(OrderStatusEnum.GENERATE);
        }
        return persistStateMachineHandler.handleEventWithState(MessageBuilder
                .withPayload(event).setHeader("order", order).build(), o.getStatus());
    }

}
```

controller层
```
  /**
     * 状态流转
     */
    @RequestMapping(value = "/order/{orderId}", method = {RequestMethod.GET})
    @ResponseBody
    public ResponseEntity<Boolean> processOrderState(
            @PathVariable("orderId") Integer orderId,
            @RequestParam("event") String event) {
        Boolean result = userService.change(orderId, OrderEventEnum.valueOf(event));
        return new ResponseEntity<>(result, HttpStatus.OK);
    }

```
我们通过订单id 和 需要触发的事件 去执行相应的逻辑，如果状态变更对应的事件不符合逻辑，则返回false。

当然如果你前端传入的参数很多的情况下，可以传入对象，可以在`MessageBuilder
                .withPayload(event).setHeader（）方法`中将具体的参数带入，之后就可以数据库的操作了。这里还要考虑并发的场景，所以查询订单建议使用乐观锁，这样做才能保证并发下的接口幂等问题

总而言之，Spring StateMachine 让状态机结构更加层次化，只需四个步骤：
* 第一步，定义状态枚举
* 第二步，定义事件枚举
* 第三步，定义状态机配置，设置初始状态，以及状态与事件之间对应关系
* 第四步，定义状态监听器，当状态变更时，触发方法


# Reference
[使用Spring StateMachine框架实现状态机](http://blog.didispace.com/spring-statemachine/)
