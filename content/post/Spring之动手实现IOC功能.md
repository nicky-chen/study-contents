

---
title: Spring之动手实现IOC功能
date: 2018-08-16T11:18:15+08:00
weight: 70
slug: spring-bean-IOC
tags: ["spring-base"]
categories: ["spring"]
author: "nicky_chin"
comments: true
share: true
draft: false
---




# 1 背景
我们经常在使用Spring生态中的组件，我们在潜移默化的DI和IOC的思想下，来创建和使用Bean对象，使用过 _@Component @ComponentScan @Autowired @Bean @Configuration_ 等等的注解，所以了解Spring容器是如何创建和管理Bean,是我们必需掌握的技能。
下面我们通过手写DI和IOC的方式来加深对Spring的理解。


#2 依赖注入
DI，**Dependency Injection**，即依赖注入。具体含义表示组件之间的依赖关系由容器在应用系统运行期来决定，也就是由容器动态地将某种依赖关系的目标对象实例注入到应用系统中的各个关联的组件之中。对象只提供普通的方法让容器去决定依赖关系。

**Spring中创建Bean的方式有三种：**

>通过XML显式配置
通过Java显式配置 (利用 @Configuration @Bean)
隐式进行bean搜索并自动装配 （利用基于@Component 元注解的方式）

通过上面叙述我们知道，创建bean其实大致可以分为两种，一种是基于XML,另一种是基于注解的方式。

#### 2.1 XML方式

user.xml
```
<?xml version="1.0" encoding="UTF-8"?>
<beans>
    <bean id="studentA" class="iockids.xml.Student" scope="singleton">
        <property name="age" value="20"/>
        <property name="name" value="nana"/>
        <property name="address" value="hangzhou"/>
    </bean>
    <bean id="studentB" class="iockids.xml.Student" scope="prototype">
        <property name="name" value="nicky"/>
        <property name="age" value="22"/>
        <property name="address" value="ningbo"/>
    </bean>
</beans>
```

Student对象
```
@Data
public class Student {

    private String name;

    private Integer age;

    private String address;

}
```

```
 /**
     * 单例对象容器
     */
    private Map<String, Object> singletonBeanFactory = new ConcurrentHashMap<>();

    /**
     * bean对象的容器
     */
    private Map<String, Class<?>> beanFactory = new ConcurrentHashMap<>();

    /**
     * beanElement对象容器
     */
    private Map<String, Element> beanElementMap = new ConcurrentHashMap<>();

    /**
     * 存储bean的scope属性容器
     */
    private Map<String, String> beanScopeMap = new ConcurrentHashMap<>();

    private static TypeConverterManager converterManager = JoddBean.get().typeConverterManager();


    /**有参的构造方法，在创建此类实例时需要指定xml文件路径*/
    public ClassPathXmlApplicationContext(String xmlPath) {
        //调用初始化方法
        init(xmlPath);
    }

    /**
     * 解析xml --> 获取bean元素 -->反射创建对象 --> 缓存对象
     * @param path 配置文件路径
     */
    private synchronized void init(String path) {

        SAXReader reader = new SAXReader();
        try {
            //获取读取xml配置文件的输入流
            InputStream is = getClass().getClassLoader().getResourceAsStream(path);
            //读取xml，该操作会返回一个Document对象
            Document document = reader.read(is);
            //获取文档的根元素
            Element rootElement = document.getRootElement();
            //获取根元素下所有的bean标签
            rootElement.elements("bean").forEach(ele ->{
                Element element = (Element) ele;
                //获取bean的id值
                String beanId = element.attributeValue("id");
                //将beanElement对象存入map中，为对象设置属性值时使用
                Element cache = beanElementMap.put(beanId, element);
                if (cache != null) {
                    throw new RuntimeException("duplicated object for the id : " + beanId);
                }
                //获取bean的scope值
                String beanScope = element.attributeValue("scope");
                //如果beanScope不等于null，将bean的scope值存入map中方便后续使用
                if(beanScope!=null){
                    beanScopeMap.put(beanId, beanScope);
                }
                //获取bean的class路径
                String beanClassPath = element.attributeValue("class");
                //利用反射技术根据获得的beanClass路径得到类定义对象
                Class<?> cls = null;
                try {
                    cls = Class.forName(beanClassPath);
                } catch (ClassNotFoundException e) {
                    e.printStackTrace();
                }
                //如果反射获取的类定义对象不为null，则放入工厂中方便创建其实例对象
                if(cls!=null){
                    beanFactory.put(beanId, cls);
                }
            });
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * @param beanName 根据bean的名称获取
     */
    public Object getBean(String beanName){

        Class<?> cls = beanFactory.get(beanName);
        //根据id获取该bean对象的element元素对象
        Element beanEle = beanElementMap.get(beanName);
        //获取存在map中的bean元素的scope属性值
        String scope = beanScopeMap.get(beanName);
        Object obj;
            //如果scope等于singleton,创建单例对象
            if(null == scope || SCOPE.SINGLETON == SCOPE.valueOf(scope.toUpperCase())){
                obj = singletonBeanFactory.get(beanName);
                if(obj != null){
                    return obj;
                }
                obj = setFieldValues(beanEle, cls);
                singletonBeanFactory.putIfAbsent(beanName, obj);
                return obj;
            }
            //如果scope等于prototype,则原型模式创建
            if(SCOPE.PROTOTYPE == SCOPE.valueOf(scope.toUpperCase())){
                return setFieldValues(beanEle, cls);
            }

            throw new RuntimeException("invalid scope");
    }


    public <T> T getBean(String beanName, Class<T> clazz) {
        return clazz.cast(getBean(beanName));
    }

    /**
     * bean是否是单例
     */
    public boolean beanIsSingleton(String beanName) {
        return singletonBeanFactory.containsKey(beanName);
    }

    /**
     * 对象设置成员属性值
     * @param beanEle bean所对应的element对象
     * @param cls 类对象
     */
    private Object setFieldValues(Element beanEle, Class<?> cls) {
        try {
            //获取每个bean元素下的所有property元素
            List<Element> properties = beanEle.elements("property");
            Object object = cls.newInstance();
            if (properties == null || properties.size() <= 0) {
                return object;
            }
            BeanInfo beanInfo = Introspector.getBeanInfo(cls, Object.class);
            PropertyDescriptor[] propertyDescriptors = beanInfo.getPropertyDescriptors();
            Map<String, PropertyDescriptor> collect = Arrays.stream(propertyDescriptors)
                    .collect(Collectors.toMap(FeatureDescriptor::getName, v -> v));
            //遍历property元素集合
            for (Element propEle : properties) {
                //获取每个元素的name属性值和value属性值
                String fieldName = propEle.attributeValue("name");
                String fieldValue = propEle.attributeValue("value");

                PropertyDescriptor descriptor = collect.get(fieldName);
                Class<?> propertyType = descriptor.getPropertyType();
                descriptor.getWriteMethod().invoke(object, converterManager.convertType(fieldValue, propertyType));
            }
            return object;
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    /**
     * 销毁方法，用于释放资源
     */
    public void destroy(){

        singletonBeanFactory.clear();
        singletonBeanFactory = null;

        beanFactory.clear();
        beanFactory = null;

        beanElementMap.clear();
        beanElementMap = null;

        beanScopeMap.clear();
        beanScopeMap = null;
    }

    enum SCOPE{
        SINGLETON,
        PROTOTYPE;
    }


}
```
基于xml的方式，其核心就是通过**DOM处理框架**来解析xml文件，然后通过反射的方式创建对象，加入到Map缓存中。

测试
```

public class SpringBeanTest {

    public static void main(String[] args) {

        //创建对象
        ClassPathXmlApplicationContext ctx = new ClassPathXmlApplicationContext("user.xml");

        Student studentA = (Student) ctx.getBean("studentA");
        System.out.println(studentA + "---是否是单例：" +ctx.beanIsSingleton("studentA"));

        Student studentB = ctx.getBean("studentB",Student.class);
        System.out.println(studentB +  "---是否是单例：" +ctx.beanIsSingleton("studentB"));

    }

}
```

打印结果
```
Student(name=nana, age=20, address=hangzhou)---是否是单例：true
Student(name=nicky, age=22, address=ningbo)---是否是单例：false
```
说明我们创建bean成功



#### 2.2 注解方式

其实DI的实现已经指定了规范，该规范定义了DI必须实现的基础注解，这也就是JSR-330规范的标准接口协议:

**JSR-330**

>@Inject : 标记为“可注入”，相当于Spring里面的Autowired
@Qualifier : 限定器，用于分门别类，最常用的是名称限定器
@Scope : 标记作用域，最常用的就是单例作用域，扩展里面还有请求作用域、会话作用域等，这不是必须的。
@Named : 基于 String 的限定器，也就是名称限定器
@Singleton : 标记为单例，也就是单例作用域

具体的依赖包
```
<dependency>
	<groupId>javax.inject</groupId>
	<artifactId>javax.inject</artifactId>
	<version>1</version>
</dependency>
```

为了更贴合实际，我们创建Spring中使用的自定义注解即如下代码：

```
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface Component {

    /**
     * 为此注解定义scope属性,默认单例
     */
    SCOPE scope() default SCOPE.SINGLETON;

    String value() default "";
}

@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Value {
    String value();
}

@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Autowired {

}
```
你可以简单理解为 @Compent注解是@Named注解和@Singleton注解组合，@Autowired类似于@Inject注解。

在Spring中的注解都是满足JSR-330规范的，具体可以看@Compent @Autowired的文档说明。

枚举类标识是单例和是原型
```
public enum SCOPE {
    SINGLETON,
    PROTOTYPE;
}
```

注解方式标记需要注入的Bean
```
@Component(scope = SCOPE.SINGLETON, value = "studentA")
@ToString
public class Student {

    @Value("nana")
    private String name;

    @Value("22")
    private Integer age;

    @Value("hangzhou")
    private String address;

}

@Component(scope=SCOPE.PROTOTYPE)
@Data
class User {

    @Value("1000.1")
    private Double amount;

    private String name;

    @Value("nicky")
    private String nickyName;

    @Value("330983199611021638")
    private String idCard;

}
```

Bean上下文
```
public class ApplicationContext {

    /**
     * 此Map容器用于存储类定义对象,只考虑一个接口只有一种实现
     */
    private Map<String, Class<?>> beanFactory = new ConcurrentHashMap<>();

    /**
     * 此Map容器用于存储单例对象
     */
    private Map<String, Object> singletonBeanFactory = new ConcurrentHashMap<>();

    private static TypeConverterManager converterManager = JoddBean.get().typeConverterManager();

    public ApplicationContext(String ... packageName) {
        //扫描指定的包路径
        for (String name : packageName) {
            initBean(name);
        }
        //进行DI依赖注入
        dependencyInjection();
    }

    private synchronized void initBean(String packageName) {
        Enumeration<URL> urls;
        try {
            urls = Thread.currentThread().getContextClassLoader().getResources(packageName.replaceAll("\\.", "/"));
            //获取目录结构在类路径中的位置(其中url中封装了具体资源的路径)
            // URL url=getClass().getClassLoader().getResource();
            while (urls.hasMoreElements()) {
                registerClass(urls.nextElement().getPath(), packageName);
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    //获取指定包路径下实现 Component主键Bean的实例
    private void registerClass(String filePath, String packageName) {
        try {
            File[] files = getClassFileList(filePath);
            if (files != null) {
                for (File f : files) {
                    String fileName = f.getName();
                    if (f.isFile()) {
                        Class<?> clazz = Class.forName(packageName + "." + fileName.substring(0, fileName.lastIndexOf(".")));
                        //判断该类是否实现了注解
                        if (clazz.isAnnotationPresent(Component.class)) {
                            Component annotation = clazz.getAnnotation(Component.class);
                            //获取bean名称
                            String key = annotation.value();
                            if ("".equals(key)) {
                                //使用命名驼峰规则
                                key = camelNameSpell(clazz.getSimpleName());
                            }
                            beanFactory.put(key, clazz);
                        }
                    } else {
                        registerClass(f.getPath(), packageName + "." + fileName);
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    //获取该路径下所遇的class文件和目录
    private static File[] getClassFileList(String filePath) {
        return new File(filePath).listFiles(new FileFilter() {

            @Override public boolean accept(File file) {
                return file.isFile() && file.getName().endsWith(".class") || file.isDirectory();
            }
        });
    }

    /**
     * 获取bean
     */
    public Object getBean(String beanName) {
        //根据传入beanId获取类对象
        Class<?> cls = beanFactory.get(beanName);
        if (cls == null) {
            throw new RuntimeException("beanName error");
        }
        //根据类对象获取其定义的注解
        Component annotation = cls.getAnnotation(Component.class);
        //获取注解的scope属性值
        SCOPE scope = annotation.scope();
        try {
            Object obj;
            //如果scope等于singleton,创建单例对象
            if (SCOPE.SINGLETON == scope) {
                obj = singletonBeanFactory.get(beanName);
                if (obj == null) {
                    obj = cls.newInstance();
                    setFieldValues(cls, obj);
                    singletonBeanFactory.putIfAbsent(beanName, obj);
                }
                return obj;
            }
            //如果scope等于prototype,则创建并返回多例对象
            if (SCOPE.PROTOTYPE == scope) {
                obj = cls.newInstance();
                setFieldValues(cls, obj);
                return obj;
            }
        } catch (ReflectiveOperationException e) {
            e.printStackTrace();
        }
        return null;
    }

    public <T> T getBean(String beanName, Class<T> cls) {
        return  cls.cast(getBean(beanName));
    }

    private void setFieldValues(Class<?> cls, Object obj) {
        //获取类中所有的成员属性
        Field[] fields = cls.getDeclaredFields();
        //遍历所有属性
        for (Field field : fields) {
            //如果此属性有Value注解修饰，对其进行操作
            if (field.isAnnotationPresent(Value.class)) {
                //获取注解中的值
                String value = field.getAnnotation(Value.class).value();
                try {
                    field.setAccessible(true);
                    field.set(obj, converterManager.convertType(value, field.getType()));
                } catch (ReflectiveOperationException e) {
                    e.printStackTrace();
                }
            }
        }
    }

    private void dependencyInjection() {

        beanFactory.forEach((k, v) -> {
            Component annotation = v.getAnnotation(Component.class);
            if (annotation.scope() == SCOPE.SINGLETON) {
                Object obj = getBean(k);
                Arrays.stream(v.getDeclaredFields()).forEach(field -> {
                    if (field.isAnnotationPresent(Autowired.class)) {
                        try {
                            field.setAccessible(true);
                            Class<?> type = field.getType();
                            Component ann = type.getAnnotation(Component.class);
                            field.set(obj, getBean("".equals(ann.value()) ? camelNameSpell(type.getSimpleName()) : ann.value()));
                        } catch (IllegalAccessException e) {
                            e.printStackTrace();
                        }
                    }
                });

            }

        });

    }

    public boolean beanIsSingleton(String beanName) {
        return singletonBeanFactory.containsKey(beanName);
    }

    /**
     * 销毁方法，用于释放资源
     */
    public void close() {
        beanFactory.clear();
        beanFactory = null;
        singletonBeanFactory.clear();
        singletonBeanFactory = null;
    }

    private static String camelNameSpell(String name) {
        if (StringUtil.isEmpty(name)) {
            return name;
        }
        return String.valueOf(name.charAt(0)).toLowerCase() + name.substring(1);

    }
}
```
通过扫描包路径的文件和反射来创建对象

测试
```
public class SpringBeanTest {

    public static void main(String[] args) {

        ApplicationContext ctx = new ApplicationContext("iockids.ioc02");

        User user=(User) ctx.getBean("user");
        System.out.println(user + "对象是否是单例： " + ctx.beanIsSingleton("user"));

        Student student = ctx.getBean("studentA", Student.class);
        System.out.println(student + "对象是否是单例： " + ctx.beanIsSingleton("studentA"));
        //销毁资源
        ctx.close();
    }

}
```
打印结果
```
User(amount=1000.1, name=null, nickyName=nicky, idCard=330983199611021638)对象是否是单例： false
Student(name=nana, age=22, address=hangzhou)对象是否是单例： true
```
通过注解方式创建Bean成功

# 3 IOC

IoC即 **控制反转**， 是一种思想，一个重要的面向对象编程的法则，它能指导我们如何设计出松耦合、更优良的程序。传统应用程序都是由我们在类内部主动创建依赖对象，从而导致类与类之间高耦合，难于测试；有了IoC容器后，把创建和查找依赖对象的控制权交给了容器，由容器进行注入组合对象，所以对象与对象之间是松散耦合，这样也方便测试，利于功能复用，更重要的是使得程序的整个体系结构变得非常灵活。

IoC很好的体现了面向对象设计法则之一—— 好莱坞法则：“不要给我们打电话，我们会给你打电话(don‘t call us, we‘ll call you)”；即由IoC容器帮对象找相应的依赖对象并注入，而不是由对象主动去找。

**IOC集成Junit**

Bean对象
```
@Component(scope=SCOPE.PROTOTYPE)
@Data
public class Teacher {

    @Value("2000.1")
    private Double amount;

    private String name;

    @Value("asuka")
    private String nickyName;

    @Value("330983199611021638")
    private String idCard;

}
```

业务层
```
@Component
public class UserService {

    @Autowired
    private Student student;

    @Autowired
    private Teacher teacher;


    public void getUserInfo(){
        System.out.println("student: " + student);
        System.out.println("teacher: " + teacher);
    }
}
```

编写测试类
```
public class SpringJunitTest extends TestCase {


   private ApplicationContext ctx;


    private UserService userService;


    @Override
    protected void setUp() {
        System.out.println("引入Spring容器");
        ctx = new ApplicationContext("iockids.ioc03", "iockids.ioc02");
        userService = ctx.getBean("userService", UserService.class);
    }


    public void testUser(){
        userService.getUserInfo();
    }

    @Override
    protected void tearDown() {
        ctx.close();
        System.out.println("销毁容器");
    }

}
```

运行 `testUser()`方法,打印结果如下：
```
引入Spring容器
student: Student(name=nana, age=22, address=hangzhou)
teacher: Teacher(amount=2000.1, name=null, nickyName=asuka, idCard=330983199611021638)
销毁容器
```
说明Spring和Junit集成成功。

在编写测试类的时候，我们通常是基于注解的，@Test注解，会将注解有该表示的方法加入到TestCase对象中，获取Spring的Bean，无非是在setup方法中，进行了处理。



