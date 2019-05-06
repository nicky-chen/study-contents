Title: Spring之动手实现SpringMVC功能
Date: 2018-08-25 20:31
Tags: spring-base
Category: spring
Slug: spring-springMvc



# 1 简介

SpringMVC大家应该耳熟能详，只要是做Java网站开发的小伙伴，都会使用的框架。SpringMVC以 _DispatcherServlet_ 为核心，负责协调和组织不同组件以完成请求处理并返回响应的工作，实现了MVC模式。接下来我们从 该框架的流程 来整理设计思路，最后自己实现一个mvc框架.


# 2 SpringMVC运行流程

springmvc的流程如下：

![流程图](https://upload-images.jianshu.io/upload_images/10175660-d0954b5dd4f6d7ba.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

**API说明**

_DispatcherServlet_：

>Spring提供的前端控制器，所有的请求都有经过它来统一分发。在DispatcherServlet将请求分发给Controller之前，需要借助于Spring提供的HandlerMapping定位到具体的Controller。

_HandlerMapping_ ：

>完成客户请求到Controller映射，包括拦截器部分内容

_Controller_ ：

>Controller将处理用户请求，调用业务层接口分析，并返回ModelAndView对象给DispatcherServlet前端控制器，ModelAndView中包含了模型（Model）和视图（View）

_ViewResolver_ ：

>Spring提供的视图解析器（ViewResolver）在Web应用中查找View对象，会根据当前的视图渲染引擎（JSP FreeMarker Thymeleaf）来渲染视图，返回给前端

**流程概述**

>* 1 用户发送请求至前端控制器DispatcherServlet
>* 2 DispatcherServlet收到请求调用HandlerMapping处理器映射器
>* 3 处理器映射器根据请求url找到具体的处理器，生成处理器对象及处理器拦截器(如果有则生成)一并返回给DispatcherServlet。
> * 4 DispatcherServlet通过HandlerAdapter处理器适配器调用处理器
> * 5 执行处理器(Controller，也叫后端控制器)。
> * 6 Controller执行完成返回ModelAndView
> * 7 HandlerAdapter将controller执行结果ModelAndView返回给DispatcherServlet
> * 8  DispatcherServlet将ModelAndView传给ViewReslover视图解析器
> * 9  ViewReslover解析后返回具体View
> * 10 DispatcherServlet对View进行渲染视图（即将模型数据填充至视图中）
> * 11 DispatcherServlet响应用户

# 3 MVC之九大组件

SpringMVC中的Servlet一共有三个层次，分别是HttpServletBean、FrameworkServlet和 DispatcherServlet。
HttpServletBean直接继承自java的HttpServlet，其作用是将Servlet中配置的参数设置到相应的属性；
FrameworkServlet初始化了WebApplicationContext，DispatcherServlet初始化了自身的9个组件。


DispatcherServlet初始化方法
```
:::java
protected void onRefresh(ApplicationContext context) {
		initStrategies(context);
	}

protected void initStrategies(ApplicationContext context) {
   initMultipartResolver(context);
		initLocaleResolver(context);
		initThemeResolver(context);
		initHandlerMappings(context);
		initHandlerAdapters(context);
		initHandlerExceptionResolvers(context);
		initRequestToViewNameTranslator(context);
		initViewResolvers(context);
		initFlashMapManager(context);
}
```

具体9个组件介绍如下：

* 1 *HandlerMapping*

用来查找Handler，在SpringMVC中会有很多请求，每个请求都需要一个Handler处理，具体接收到一个请求之后使用哪个Handler进行处理呢？这就是HandlerMapping需要做的事。

* 2 *HandlerAdapter*

    从名字上看，它就是一个适配器。因为SpringMVC中的Handler可以是任意的形式，只要能处理请求就ok，但是Servlet需要的处理方法的结构却是固定的，都是以request和response为参数的方法。如何让固定的Servlet处理方法调用灵活的Handler来进行处理呢？这就是HandlerAdapter要做的事情。

* 3  *HandlerExceptionResolver*

其它组件都是用来干活的。在干活的过程中难免会出现问题，出问题后怎么办呢？这就需要有一个专门的角色对异常情况进行处理，在SpringMVC中就是HandlerExceptionResolver。具体来说，此组件的作用是根据异常设置ModelAndView，之后再交给render方法进行渲染。

* 4 *ViewResolver*

 ViewResolver用来将String类型的视图名和Locale解析为View类型的视图。View是用来渲染页面的，ViewResolver需要找到渲染所用的模板和所用的技术（也就是视图的类型）进行渲染，具体的渲染过程则交由不同的视图自己完成。

* 5 *RequestToViewNameTranslator*

ViewName是根据ViewName查找View，但有的Handler处理完后并没有设置View也没有设置ViewName，这时就需要从request获取ViewName了，如何从request中获取ViewName就是RequestToViewNameTranslator要做的事情了。RequestToViewNameTranslator在Spring MVC容器里只可以配置一个，所以所有request到ViewName的转换规则都要在一个Translator里面全部实现。

* 6 *LocaleResolver*

    解析视图需要两个参数：一是视图名，另一个是Locale。视图名是处理器返回的，Locale是从哪里来的？这就是LocaleResolver要做的事情。LocaleResolver用于从request解析出Locale，Locale就是zh-cn之类，表示一个区域，有了这个就可以对不同区域的用户显示不同的结果。SpringMVC主要有两个地方用到了Locale：一是ViewResolver视图解析的时候；二是用到国际化资源或者主题的时候。

* 7 *ThemeResolver*

    用于解析主题。SpringMVC中一个主题对应一个properties文件，里面存放着跟当前主题相关的所有资源、如图片、css样式等。SpringMVC的主题也支持国际化，同一个主题不同区域也可以显示不同的风格。SpringMVC中跟主题相关的类有 ThemeResolver、ThemeSource和Theme。主题是通过一系列资源来具体体现的，要得到一个主题的资源，首先要得到资源的名称，这是ThemeResolver的工作。然后通过主题名称找到对应的主题（可以理解为一个配置）文件，这是ThemeSource的工作。最后从主题中获取资源就可以了。

* 8 *MultipartResolver*

用于处理上传请求。处理方法是将普通的request包装成MultipartHttpServletRequest，后者可以直接调用getFile方法获取File，如果上传多个文件，还可以调用getFileMap得到FileName->File结构的Map。此组件中一共有三个方法，作用分别是判断是不是上传请求，将request包装成MultipartHttpServletRequest、处理完后清理上传过程中产生的临时资源。

* 9 *FlashMapManager*

用来管理FlashMap的，FlashMap主要用在redirect中传递参数。


### 3.2 SpringMVC的设计思路

![MVC类图](https://upload-images.jianshu.io/upload_images/10175660-36c6355383de4367.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

为了读取web.xml中的配置，我们用到ServletConfig这个类，它代表当前Servlet在web.xml中的配置信息。通过web.xml中加载我们自己写的DispatcherServlet和读取配置文件。

DispatcherServlet是整个Spring MVC的核心。它负责接收HTTP请求组织协调Spring MVC的各个组成部分。其主要工作有以下三项：

>1.截获符合特定格式的URL请求。
2.初始化DispatcherServlet上下文对应的WebApplicationContext，并将其与业务层、持久化层的WebApplicationContext建立关联。
3.初始化Spring MVC的各个组成组件，并装配到DispatcherServlet中。

# 4 动手实现SpringMVC

项目目录结构如下：
![项目结构.PNG](https://upload-images.jianshu.io/upload_images/10175660-70f9980e4b26f96f.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

注解
```
:::java
@Target({ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Autowired {
}

@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@Documented
public @interface ComponentScan {

    String[] basePackages() default {};
}

@Target({java.lang.annotation.ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Controller {
    String value() default "";
}


@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD, ElementType.FIELD})
@Documented
public @interface Order {

	int value() default Integer.MAX_VALUE;

}

@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RequestMapping {

    String value() default "";

    RequestMethod[] method() default {};
}

public enum RequestMethod {

	GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS, TRACE

}

@Target({ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RequestParam {

    String value() default "";
}

@Target({java.lang.annotation.ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Service {

    String beanName() default "";
}

```
这些注解没什么好解释的，平时大家开发中常用

IOC方法
```
:::java
@ComponentScan(basePackages = "com.nicky")
public class ApplicationContext {

    private final Logger logger = LoggerFactory.getLogger(this.getClass());

    private volatile static boolean beanIsInitialized = false;

    private List<String> classNames = new CopyOnWriteArrayList<>();

    private Map<String, Object> beanFactory = new ConcurrentHashMap<>();

    private ApplicationContext() {
        synchronized (ApplicationContext.class) {
            if (!beanIsInitialized) {
                beanIsInitialized = true;
                //扫描包
                scanPackage(this.getClass().getAnnotation(ComponentScan.class).basePackages()[0]);
                //实例化
                instance();
                //依赖注入
                dependencyInjection();

            } else {
                throw new RuntimeException("ApplicationContext is only be created by singleton");

            }
        }
    }

    private static class ApplicationContextHolder{

        private static final ApplicationContext CONTEXT = new ApplicationContext();
    }

    public synchronized static ApplicationContext getApplicationContext() {
        if (!beanIsInitialized) {
            return ApplicationContextHolder.CONTEXT;
        }
        return null;
    }

    public Object getBean(String beanName) {
        Object o = beanFactory.get(beanName);
        if (o == null) {
            throw new RuntimeException("bean not found");
        }
        return o;
    }

    public <T> T getBean(String beanName, Class<T> cls) {
        return cls.cast(getBean(beanName));
    }

    public Map<String, Object> getBeanFactory (){
        return beanFactory;
    }

    private void dependencyInjection() {

        if (CollectionUtils.isEmpty(beanFactory.entrySet())) {
            logger.error("instance has not been over");
            return;
        }
        beanFactory.forEach((k, v) ->{
            Class cls = v.getClass();
            if (cls.isAnnotationPresent(Controller.class) || cls.isAnnotationPresent(Service.class)) {
                Arrays.stream(cls.getDeclaredFields()).forEach(field -> {
                    if (field.isAnnotationPresent(Autowired.class) && classNames.contains(field.getType().getName())) {
                        field.setAccessible(true);
                        try {
                            field.set(v, beanFactory.get(camelNameSpell(field.getType().getSimpleName())));
                        } catch (IllegalAccessException e) {
                            logger.error("error dependencyInjection", e);
                        }
                    }
                });
                //beanFactoryAware applicationContextAware
                if (BeanFactoryAware.class.isAssignableFrom(cls)) {
                    try {
                        Method method = cls.getMethod("setBeanFactory", Map.class);
                        method.invoke(v, beanFactory);
                    } catch (ReflectiveOperationException e) {
                        logger.error("beanFactoryAware error", e);
                    }
                }
            }
        });


    }

    /**
     * 销毁方法，用于释放资源
     */
    public void close() {
        beanFactory.clear();
        beanFactory = null;
    }

    private void scanPackage(String basePackage) {

        URL url = this.getClass().getClassLoader().getResource(basePackage.replaceAll("\\.", "/"));
        File[] classFileList = getClassFileList(url.getPath());
        if (classFileList != null) {
            for (File file : classFileList) {
                if (file.isDirectory()) {
                    scanPackage(basePackage + "." + file.getName());
                }else {
                    String className = basePackage+"."+file.getName().replace(".class", "");
                    classNames.add(className);
                }
            }
        }
    }

    //获取该路径下所遇的class文件和目录
    private static File[] getClassFileList(String filePath) {
        return new File(filePath).listFiles(
                file -> file.isFile() && file.getName().endsWith(".class") || file.isDirectory());
    }

    private void instance() {
        if (CollectionUtils.isEmpty(classNames)) {
            logger.error("scan path error！");
            return;
        }

        for (String className : classNames) {
            try {
                Class<?> clazz = Class.forName(className);
                if (clazz.isInterface()) {
                    continue;
                }
                if (clazz.isAnnotationPresent(Controller.class)) {
                    Controller annotation = clazz.getAnnotation(Controller.class);
                    Object instance = clazz.newInstance();
                    //不指定beanName,采用驼峰命名
                    Object o = beanFactory.putIfAbsent(StringUtils.isEmpty(annotation.value()) ?
                            camelNameSpell(clazz.getSimpleName()) :
                            annotation.value(), instance);
                    if (o != null) {
                        throw new RuntimeException(String.format("duplicated beanName %s", clazz.getSimpleName()));
                    }
                }

                if (clazz.isAnnotationPresent(Service.class)) {
                    Service service = clazz.getAnnotation(Service.class);
                    Object instance = clazz.newInstance();
                    Object o = beanFactory.putIfAbsent(StringUtils.isEmpty(service.beanName()) ?
                            camelNameSpell(clazz.getSimpleName()) :
                            service.beanName(), instance);
                    if (o != null) {
                        throw new RuntimeException(String.format("duplicated beanName %s", clazz.getSimpleName()));
                    }
                }
            } catch (ReflectiveOperationException e) {
                logger.error("instance reflect error", e);
            }
        }
    }

    private static String camelNameSpell(String name) {
        if (StringUtils.isEmpty(name)) {
            return name;
        }
        return String.valueOf(name.charAt(0)).toLowerCase() + name.substring(1);

    }

}
```

*Aware 用于获取Aware名称前面的*对象
```
:::java
public interface ApplicationContextAware{

	void setApplicationContext(ApplicationContext applicationContext);

}

public interface BeanFactoryAware {

    void setBeanFactory(Map<String, Object> beanFactory);
}
```

controller 和service

```
:::java
@Controller("testController")
@RequestMapping("/user")
public class UserController {

    private final Logger logger = LoggerFactory.getLogger(getClass());
    
    @Autowired
    private UserService userService;

    @RequestMapping("/query.do")
    public void queryUserInfo(HttpServletRequest request, HttpServletResponse response, @RequestParam("userName") String userName) {
        logger.info("userName: {}", userName );
        try {
            PrintWriter pw = response.getWriter();
            String result = userService.query(userName);
            pw.write(result);
        }
        catch (IOException e) {
            logger.error("test", e);
        }
    }

    @RequestMapping("/insert.do")
    public String insert(String param) {
        return "success";
    }
}

public interface UserService {
    
    String query(String param);
    
}

@Service(beanName = "userService")
public class UserServiceImpl implements UserService {
    
    @Override
    public String query(String param) {
       return "User:{name = nicky, age = 23}" ;
    }

}

```

接下来是核心类
DispatcherServlet
```
:::java
@NoArgsConstructor
@Service
public class DispatcherServlet extends FrameworkServlet {

    private static final long serialVersionUID = -6961498140472266321L;

    private static final Logger logger = LoggerFactory.getLogger(DispatcherServlet.class);
    
    private Map<String, HandlerMapping> handlerMappings = new ConcurrentHashMap<>();
    
    private static Properties prop;

    private final String handlerAdapter = "spring.bean.handlerAdapter";

    static {

        InputStream is = DispatcherServlet.class.getResourceAsStream("/application.properties");
        prop = new Properties();
        try {
            prop.load(is);
        } catch (IOException e) {
            logger.error("static block error", e);
        }
    }


    @Override
    public void init(ServletConfig config) {
        //处理映射
        handlerMapping();
        
    }
    

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) {
        processRequest(request, response);
        ServletRequestAttributes requestAttributes = RequestContextHolder.getRequestAttributes();
        doPost(requestAttributes.getRequest(), requestAttributes.getResponse());
    }


    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response){
        String uri = request.getRequestURI();
        String context = request.getContextPath();
        String path = uri.replace(context, "");
        logger.warn("access path :{}", path);

        String className = prop.getProperty(handlerAdapter);
        Class<?> cls = null;
        try {
            cls = Class.forName(className);
        } catch (ClassNotFoundException e) {
            logger.error("adapter not found", e);
        }
        Service annotation = cls.getAnnotation(Service.class);
        HandlerAdapter adapter = applicationContext.getBean(annotation.beanName(), HandlerAdapter.class);
        HandlerMapping handlerMapping = handlerMappings.get(path);
        if (handlerMapping == null) {
            try {
                PrintWriter pw = response.getWriter();
                pw.write("404, page not found");
                return;
            } catch (IOException e) {
                e.getLocalizedMessage();
            }
        }
        adapter.handle(request, response, handlerMapping);
        
    }
    
    private void handlerMapping() {

        for (Map.Entry<String, Object> entry : applicationContext.getBeanFactory().entrySet()) {
            Object instance = entry.getValue();
            Class<?> clazz = instance.getClass();

            if (clazz.isAnnotationPresent(Controller.class)) {
                Controller annotation = clazz.getAnnotation(Controller.class);
                RequestMapping requestMapping = clazz.getAnnotation(RequestMapping.class);
                String rootPath = requestMapping.value();

                for (Method method : clazz.getMethods()) {
                    if (method.isAnnotationPresent(RequestMapping.class)) {
                        RequestMapping subMethod = method.getAnnotation(RequestMapping.class);
                        String methodPath = subMethod.value();
                        handlerMappings.putIfAbsent(rootPath + methodPath, new HandlerMapping(annotation.value(), method));
                    }
                }
            }
        }
    }

}

public abstract class FrameworkServlet extends HttpServlet {

    protected ApplicationContext applicationContext;

    public FrameworkServlet() {
        applicationContext = ApplicationContext.getApplicationContext();
    }

    /**
     * 保证单例servlet下的请求线程安全
     */
    protected final void processRequest(HttpServletRequest request, HttpServletResponse response) {
        RequestContextHolder.resetRequestAttributes();
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request, response));
    }

}
```
首先 静态块中的内容会预加载，即获取resouce下application.properties文件的内容，存入对象中。并且创建DispatcherServlet对象的时候，会获取到applicationcontext。

当http请求过来的时候，第一次会触发DispatcherServlet的`init(ServletConfig config)`方法，这里的`handlerMapping()`方法会在初始化的时候获取controller中的URL链接并保存。

之后get请求会进入`doGet`方法,因为考虑到servlet是单例的，所以请求会有并发线程安全问题，所以我们通过**ThreadLocal**去解决，在`processRequest(request, response)`;方法中,最后会调用RequestContextHolder这个类的方法，具体代码如下：

```
:::java
public final class RequestContextHolder {

    private static final ThreadLocal<ServletRequestAttributes> requestHolder =
            new NamedThreadLocal<>("Request attributes");


    private static final ThreadLocal<ServletRequestAttributes> inheritableRequestHolder =
            new NamedInheritableThreadLocal<>("Request context");


    public static void resetRequestAttributes() {
        requestHolder.remove();
        inheritableRequestHolder.remove();
    }

    public static void setRequestAttributes(ServletRequestAttributes attributes) {
        setRequestAttributes(attributes, false);
    }

    public static void setRequestAttributes(ServletRequestAttributes attributes, boolean inheritable) {
        if (attributes == null) {
            resetRequestAttributes();
        }
        else {
            if (inheritable) {
                inheritableRequestHolder.set(attributes);
                requestHolder.remove();
            }
            else {
                requestHolder.set(attributes);
                inheritableRequestHolder.remove();
            }
        }
    }


    public static ServletRequestAttributes getRequestAttributes() {
        ServletRequestAttributes attributes = requestHolder.get();
        if (attributes == null) {
            attributes = inheritableRequestHolder.get();
        }
        return attributes;
    }

}


@Data
public class ServletRequestAttributes {

    private final HttpServletRequest request;

    private final HttpServletResponse response;

}

public class NamedInheritableThreadLocal<T> extends InheritableThreadLocal<T> {

	private final String name;


	/**
	 * Create a new NamedInheritableThreadLocal with the given name.
	 * @param name a descriptive name for this ThreadLocal
	 */
	public NamedInheritableThreadLocal(String name) {
		Assert.hasText(name, "Name must not be empty");
		this.name = name;
	}

	@Override
	public String toString() {
		return this.name;
	}

}

public class NamedThreadLocal<T> extends ThreadLocal<T> {

	private final String name;


	/**
	 * Create a new NamedThreadLocal with the given name.
	 * @param name a descriptive name for this ThreadLocal
	 */
	public NamedThreadLocal(String name) {
		Assert.hasText(name, "Name must not be empty");
		this.name = name;
	}

	@Override
	public String toString() {
		return this.name;
	}

}
```
当进入`doPost`方法的时候，会通过HandlerAdapter对象来处理具体的请求，通过分析 HandlerMapping 查询，当前请求的地址是否可以分发到已有的controller中，如果没有则，直接向前端页面报错 404，如果有，则通过 HandlerAdapter继续处理

```
:::java
@Service(beanName = "handlerAdapter")
public class HttpRequestHandlerAdapter implements HandlerAdapter, BeanFactoryAware {

    private Map<String, Object> beanFactory;
    
    @Override
    public ModelAndView handle(HttpServletRequest request, HttpServletResponse response, HandlerMapping handler) {

        Method method = handler.getMethod();
        Class<?>[] paramList = method.getParameterTypes();
        
        Object[] args = new Object[paramList.length];
        
        //获取接口的实现
        Map<String, Object> resolvers = getBeanInterfaceImpl(HandlerMethodArgumentResolver.class);
        //todo HandlerMethodArgumentResolver 可以排序
        int paramIndex = 0, i = 0;
        for (Class<?> paramClazz : paramList) {
            for (Map.Entry<String, Object> entry : resolvers.entrySet()) {
                HandlerMethodArgumentResolver resolver = (HandlerMethodArgumentResolver)entry.getValue();
                MethodParameter warp = new MethodParameter(paramClazz, paramIndex, method);
                if (resolver.supportsParameter(warp)) {
                    args[i++] = resolver.resolveArgument(request, response, warp);
                }
            }
            paramIndex++;
        }
        Map<String, Object> model = new HashMap<>(1);
        ModelAndView view = new ModelAndView();
        Object obj;
        try {
            Object instance = beanFactory.get(handler.getControllerBeanName());
            obj = method.invoke(instance, args);
            //如果调用方法没有传入HttpServletResponse参数，则自己封装
            if (!Arrays.asList(paramList).contains(HttpServletResponse.class)) {
                PrintWriter writer = response.getWriter();
                writer.write(obj.toString());
            }
            //移除ThreadLocal副本
            RequestContextHolder.resetRequestAttributes();
        } catch (ReflectiveOperationException | IOException e) {
            view.setStatus(HttpStatus.EXPECTATION_FAILED);
            model.put("result", e.getLocalizedMessage());
            view.setModel(model);
            return view;
        }
        view.setStatus(HttpStatus.OK);
        model.put("result",obj);
        view.setModel(model);
        return view;
    }
    
    private Map<String, Object> getBeanInterfaceImpl(Class<?> interfaceType) {
        
        Map<String, Object> result = new HashMap<>();
        beanFactory.forEach((k, v) ->{
            if (interfaceType.isAssignableFrom(v.getClass())) {
                result.put(k, v);
            }
        });
        return result;
    }

    @Override
    public void setBeanFactory(Map<String, Object> beanFactory) {
        this.beanFactory = beanFactory;
    }
}

public interface HandlerAdapter {
    
    ModelAndView handle(HttpServletRequest request, HttpServletResponse response, HandlerMapping handler);
}

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class HandlerMapping {

    private String controllerBeanName;

    private Method method;

}

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ModelAndView {

    private HttpStatus status;

    private Map<String, Object> model;

}
```
HttpRequestHandlerAdapter为HandlerAdapter的具体实现，它同时实现了BeanFactoryAware，主要是为了获取BeanFactory对象

`handle`方法中首先会获取到需要请求的HandlerMapping,它包含了controller的信息，然后对 controller对应路由的方法中所持有的参数做拦截处理即 HandlerMethodArgumentResolver 对象:

```
:::java
public interface HandlerMethodArgumentResolver {
    
    boolean supportsParameter(MethodParameter methodParameter);
    
    Object resolveArgument(HttpServletRequest request, HttpServletResponse response, MethodParameter methodParameter);

    default int getOrderAnnotationValue(){
        Order annotation = this.getClass().getAnnotation(Order.class);
        if (annotation == null) {
            return Integer.MAX_VALUE;
        }
        return annotation.value();
    }
}

public abstract class AbstractOrderResolver implements HandlerMethodArgumentResolver {

    protected int order = Integer.MAX_VALUE;

    public AbstractOrderResolver() {
        setOrder();
    }

    protected boolean paramConfirm(MethodParameter parameter, Class targetClass) {

        try {
            return ClassUtils.isAssignable(targetClass, parameter.getParamType());
        }
        catch (Exception ex) {
            return false;
        }
    }

    public void setOrder(){
        order = this.getOrderAnnotationValue();
    }

    public int getOrder() {
        return order;
    }
}

@Service(beanName = "handlerRequestArgumentResolver")
@Order(10)
public class HandlerRequestArgumentResolver extends AbstractOrderResolver {
    
    @Override
    public boolean supportsParameter(MethodParameter methodParameter) {
        return paramConfirm(methodParameter, ServletRequest.class);
    }
    
    @Override
    public Object resolveArgument(HttpServletRequest request, HttpServletResponse response, MethodParameter methodParameter) {
        System.out.println("ServletRequest.class");
        return request;
    }

}

@Service(beanName = "handlerResponseArgumentResolver")
@Order(1)
public class HandlerResponseArgumentResolver extends AbstractOrderResolver {
    
    @Override
    public boolean supportsParameter(MethodParameter methodParameter) {
        return paramConfirm(methodParameter, ServletResponse.class);
    }
    
    @Override
    public Object resolveArgument(HttpServletRequest request,
            HttpServletResponse response, MethodParameter methodParameter) {
        System.out.println("ServletResponse.class");
        return response;
    }
    
}

@Service
public class RequestParamArgumentResolver extends AbstractOrderResolver {
    
    @Override
    public boolean supportsParameter(MethodParameter methodParameter) {
        
        Annotation[][] an = methodParameter.getMethod().getParameterAnnotations();
        
        Annotation[] paramAns = an[methodParameter.getParamIndex()];
        
        for (Annotation paramAn : paramAns) {
            if (RequestParam.class.isAssignableFrom(paramAn.getClass())) {
                return true;
            }
        }
        return false;
    }
    
    @Override
    public Object resolveArgument(HttpServletRequest request, HttpServletResponse response, MethodParameter methodParameter) {

        Annotation[][] an = methodParameter.getMethod().getParameterAnnotations();
        Annotation[] paramAns = an[methodParameter.getParamIndex()];
        
        for (Annotation paramAn : paramAns) {
            if (RequestParam.class.isAssignableFrom(paramAn.getClass())) {
                RequestParam rp = (RequestParam)paramAn;
                String value = rp.value();
               return request.getParameter(value);
            }
        }
        return null;
    }

    @Override
    public void setOrder() {
        order = 100;
    }
}

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MethodParameter {

    private Class<?> paramType;

    private int paramIndex;

    private Method method;

}
```
会筛选对应的方法中的参数，进行拦截处理。最后通过执行反射来获取具体的内容


我们先借用springboot的IOC容器来构建我们的SpringMVC框架

```
:::java
@Configuration
public class ContainerConfig {


    @Bean
    public ServletRegistrationBean MyServlet1(){
        ServletRegistrationBean bean = new ServletRegistrationBean();
        bean.setServlet(new DispatcherServlet());
        bean.getUrlMappings().clear();
        bean.addUrlMappings("/user/*");
        return bean;
    }

}
```
启动项目，访问页面

成功：
![success.PNG](https://upload-images.jianshu.io/upload_images/10175660-ac407f86bab8102d.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

失败：
![error.PNG](https://upload-images.jianshu.io/upload_images/10175660-f0cfa256faeeda03.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

如果你不使用springboot，你可以使用web.xml来指定servlet来实现

当然我们也可以通过springboot基于SPI来实现，通过Servlet3.0的规范来实现

```
:::java
public class ServletConfig implements ServletContainerInitializer {

    @Override
    public void onStartup(Set<Class<?>> c, ServletContext container) throws ServletException {

        System.out.println("启动加载自定义的MyServletContainerInitializer");
        ServletRegistration.Dynamic dispatcher = container.addServlet("dispatcherServlet", "com.nicky.servlet.DispatcherServlet");
        dispatcher.setLoadOnStartup(1);
        dispatcher.addMapping("/");

    }
}
```

![spi.PNG](https://upload-images.jianshu.io/upload_images/10175660-e0b48e8f31aeb880.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

在javax.servlet.ServletContainerInitializer加入spi.ServletConfig，然后打成jar包，最后向springmvc的项目打成war包，将spi的jar包放入WEB-INF\lib目录下重启服务即可，spi入门可参考我的文章[框架基础之SPI机制](https://www.jianshu.com/p/7b69543c348e)







#Reference
[【SpringMVC】9大组件概览](https://blog.csdn.net/hu_zhiting/article/details/73648939)
