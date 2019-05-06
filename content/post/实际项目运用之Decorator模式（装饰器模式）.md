---
title: 实际项目运用之Decorator模式（装饰器模式）
date: 2018-03-28T11:18:15+08:00
weight: 70
slug: decorator
tags: ["结构型"]
categories: ["design-pattern"]
author: "nicky_chin"
comments: true
share: true
draft: false
---



## 1 概述
在项目中，经常因一些新增需求，导致同一业务的变更，如果所在类继承关系如下：Parent、Child、Grandparent，那么要在Child类上增强些功能怎么办？给Child类增加方法？那会对Grandparent产生什么影响？该如何去处理？看完本文，你会找到你的答案。

JavaIO中，像下面的嵌套语句很常见，为什么要怎样定义呢？理解装饰模式后，你会找到答案。
```
FilterInputStream filterInputStreasm = new BufferedInputStream(new FileInputStream(new File("/user/a")));
```
### 1.1案例
例如下面一个功能需求，4s店的汽车销售向客户推销自家品牌的产品，我们用代码实现，关系如下：

![类图](https://upload-images.jianshu.io/upload_images/10175660-789e0242028d08b0.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)


具体代码：
汽车销售类
```
public abstract class CarSale {

    /**
     * 推销车的详情
     */
    public abstract void displayCarInfo();

    /**
     * 客户签订购买合同
     */
    public abstract void signContract(String customerName);

}
```
汽车参数详情
   ```
public class CarInfo extends CarSale {

    @Override
    public void displayCarInfo() {
        System.out.println("日本丰田GTR");
        System.out.println("百公里加速1秒");
        System.out.println("油耗偏高");
        System.out.println("后驱涡轮增压");
        System.out.println("内饰豪华");
        System.out.println("发动机噪音偏大");
        System.out.println("不支持电动座椅，后视镜加热");
    }

    @Override
    public void signContract(String customerName) {
        System.out.println("客户签约销售合同， 付款人：" + customerName);
    }
}
```

客户
```
public class Customer {

    public static void main(String[] args) {
        CarInfo carInfo = new CarInfo();
        //介绍车性能
        carInfo.displayCarInfo();
        //油耗太高？？噪音大 推销我买？？ 不存在的
       // carInfo.signContract();
    }

}
```
如果销售并没有很有针对性的去讲解，突出推销车型的优点，买家是不太会买账的，所以作为一个salesman我们需要修改一下我们的营销技巧，比如： 突出速度上的优势，突出后驱车这个特点，
修改后的图示关系如下：
![类关系图](https://upload-images.jianshu.io/upload_images/10175660-d30991660bd22700.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)



客户营销类
```
public class SalesTalk extends CarInfo {

    private void showSpeedRank() {
        System.out.println("这个车百公里加速快，外观吊炸天，装逼神器啊，大兄弟");
    }

    private void showWheelSys() {
        System.out.println("后驱车，让你漂移分分钟，就问对方怕不怕");
    }

    /**
     * 使用销售技巧，提高签约成功率
     */
    @Override
    public void displayCarInfo() {
        showSpeedRank();
        super.displayCarInfo();
        showWheelSys();
    }
}
```

客户2
```
public class Customer2 {

    public static void main(String[] args) {
        SalesTalk salesTalk = new SalesTalk();
        //销售一顿吹
        salesTalk.displayCarInfo();
        System.out.println("。。。。。");
        //艹,买买买
        salesTalk.signContract("不差钱哥");
    }

}
```
客户看到销售人员的激情推销，感觉有些心动，毕竟日本神车，最后还是忍不住宣传的力度，签订了销售合同。但是如果这时候，客户还是不买账，我们该怎么办，继续通过突出其他优势来营销么，这样会产生多少个子类，这样会导致类爆炸，类的数量激增，想想以后维护怎么办？并且在面向对象的设计中，如果超过两层继承，你就应该想想是不是出设计问题了，继承层次越多以后的维护成本越多，问题这么多，那怎么办？我们定义一批专门负责装饰的类，然后根据实际情况来决定是否需要进行装饰，类图稍做修正，如图所示
![装饰修饰](https://upload-images.jianshu.io/upload_images/10175660-884183df2ae82b53.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

增加一个抽象类和两个实现类，其中Decorator的作用是封装CarSale类

抽象类
```
public abstract class Decorator extends CarSale {

    /**
     * 销售技巧选择
     */
    private CarSale carSale;

    public Decorator(CarSale carSale) {
        this.carSale = carSale;
    }

    @Override
    public void displayCarInfo() {
        this.carSale.displayCarInfo();
    }

    @Override
    public void signContract(String customerName) {
        this.carSale.signContract(customerName);
    }
}
```
在构造器中定义需要装饰的类，然后调用displayCarInfo()进行修饰，有点类似代理模式

速度排名
```
public class SpeedRankDecorator extends Decorator {

    public SpeedRankDecorator(CarSale carSale) {
        super(carSale);
    }

    //突出速度特点
    private void showSpeedRank() {
        System.out.println("这个车百公里加速快，外观吊炸天，装逼神器啊，大兄弟");
    }

    //宣传
    @Override
    public void displayCarInfo() {
        showSpeedRank();
        super.displayCarInfo();
    }
}

```

驱动情况
```
public class WheelDeployDecorator extends Decorator {

    public WheelDeployDecorator(CarSale carSale) {
        super(carSale);
    }

    //突出后驱车的优势De
    private void showWheelSys() {
        System.out.println("后驱车，让你漂移分分钟，就问对方怕不怕");
    }

    @Override
    public void displayCarInfo() {
        showWheelSys();
        super.displayCarInfo();
    }
}
```
客户3
```
public class Customer3 {

    public static void main(String[] args) {
        //需要被装饰的类
        CarInfo carInfo = new CarInfo();
        System.out.println("-----------速度排名--------------");
        Decorator decorator = new SpeedRankDecorator(carInfo);
        decorator.displayCarInfo();

        System.out.println("---------汽车驱动-----------");
        decorator = new WheelDeployDecorator(carInfo);
        decorator.displayCarInfo();
        //听的很舒服那就买
        decorator.signContract("土豪");

    }

}
```
如上所示，通过装饰器，我们可以很轻松的包装我们想要的对象

## 2 装饰模式（Decorator Pattern）
### 概念
>装饰器模式 允许向一个现有的对象添加新的功能，同时又不改变其结构。装饰者可以在所委托被装饰者的行为之前或之后加上自己的行为，以达到特定的目的。

### 2.1 组成
![模式类图](https://upload-images.jianshu.io/upload_images/10175660-3292fa99600cd495.jpg?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

装饰器模式由组件和装饰者组成。

抽象组件（Component）：需要装饰的抽象对象。 
具体组件（ConcreteComponent）：是我们需要装饰的对象 
抽象装饰类（Decorator）：内含指向抽象组件的引用及装饰者共有的方法。 
具体装饰类（ConcreteDecorator）：被装饰的对象。

### 2.2 装饰模式的简化
如果只有一个ConcreteComponent类，那么可以考虑去掉抽象的Component类（接口），把Decorator作为一个ConcreteComponent子类。如下图所示：
![装饰模式](https://upload-images.jianshu.io/upload_images/10175660-d8d99c42e2c36eb7.gif?imageMogr2/auto-orient/strip)

如果只有一个ConcreteDecorator类，那么就没有必要建立一个单独的Decorator类，而可以把Decorator和ConcreteDecorator的责任合并成一个类。

透明性的要求
装饰模式对客户端的透明性要求程序不要声明一个ConcreteComponent类型的变量，而应当声明一个Component类型的变量。

用上面汽车推销的例子来说有：
```
        CarInfo carInfo = new CarInfo();
        System.out.println("-----------速度排名--------------");
        Decorator decorator = new SpeedRankDecorator(carInfo);
        decorator.displayCarInfo();

        System.out.println("---------汽车驱动-----------");
        decorator = new WheelDeployDecorator(carInfo);
        decorator.displayCarInfo();
        //听的很舒服那就买
        decorator.signContract("土豪");
```
  而不是下面的做法：
```
 WheelDeployDecorator decorator = new WheelDeployDecorator(carInfo);
```

### 2.3 装饰者模式的优缺点
优点
	可以动态的扩展功能；
	装饰者和被装饰者解耦，互相不关联。

缺点：
	多层装饰比较复杂。

装饰者模式的适用场景：
	扩展一个类的功能；
	动态增加和撤销功能。

注意：装饰者模式可以替代繁杂的继承，但其内部实现使用的也是继承。也就是说，装饰者模式将繁杂的继承转化成了其内部的简单的继承。



## 3 装饰模式IO流中的运用
装饰模式在Java语言中的最著名的应用莫过于Java I/O标准库的设计了。

由于Java I/O库需要很多性能的各种组合，如果这些性能都是用继承的方法实现的，那么每一种组合都需要一个类，这样就会造成大量性能重复的类出现。而如果采用装饰模式，那么类的数目就会大大减少，性能的重复也可以减至最少。因此装饰模式是Java I/O库的基本模式。

JavaI/O库的对象结构图如下，由于Java I/O的对象众多，因此只画出InputStream的部分。
![inputstream](https://upload-images.jianshu.io/upload_images/10175660-957c5000047a4ad7.JPG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

根据上图可以看出：

●抽象构件(Component)角色：由InputStream扮演。这是一个抽象类，为各种子类型提供统一的接口。

●具体构件(ConcreteComponent)角色：由ByteArrayInputStream、FileInputStream、PipedInputStream等类扮演。它们实现了抽象构件角色所规定的接口。

●抽象装饰(Decorator)角色：由FilterInputStream扮演。它实现了InputStream所规定的接口。

●具体装饰(ConcreteDecorator)角色：由几个类扮演，有BufferedInputStream、DataInputStream、HttpInputStream等

```
public class IOTest {

    public static void main(String[] args) {
        //抽象装饰器                              具体装饰器                      被装饰对象
        FilterInputStream filterInputStream = new BufferedInputStream(new ByteArrayInputStream("input-test".getBytes()));
        byte[] bs = new byte[0];
        try {
            bs = new byte[filterInputStream.available()];
            filterInputStream.read(bs);
        } catch (IOException e) {
            e.printStackTrace();
        }
        String content = new String(bs);
        System.out.println(content);
    }

}
```

**像其他的OutputStream Read  Writer  就列举了其抽象装饰器分别是 FilterOutputStream FilterReader FilterWriter**

## 4 实际项目中的运用
### 4.1 需求
在金融项目数据加密是非常常见的，比如前端将加密后的字符串作为参数传给我们，
我们在接口中解密，再比如我们后端返回给前端的结果也是一串加密后的字符串，这是防止爬虫的一种安全手段，那么我们是否需要在每个接口在去进行加密解密？是否有一套机制去控制我想要加密的接口，同学们应该会想到只需在一个请求到达Controller之前能够截获其请求，并且根据其具体情况对 HttpServletRequest 中的参数进行过滤或者修改。然后再放回到该HttpServletRequest 中呢？

流只能读取一次，读取前端传过来的参数具体参数，如果是post请求，那么getInputStream()可以解析到详细的参数

在正式代码之前，我还是先简单介绍下ServletRequest、HttpServletRequest、ServletRequestWrapper以及HttpServletRequestWrapper这几个接口或者类之间的层次关系，并说明“继承HttpServletRequestWrapper类以实现在Filter中修改HttpServletRequest的参数”这种方式的原理是什么

它们之间的层次关系是这样的：
![tomcat-ServletRequest 关系图](https://upload-images.jianshu.io/upload_images/10175660-6fd8c6fff69d8260.JPG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)


如上图所示，在过滤器中：
```
//我们会进入这个方法
doFilter(ServletRequest request, ServletResponse response, FilterChain chain)

//通过ServletRequest进来的，之后我们会强制造型如下：
 HttpServletRequest req=(HttpServletRequest) request;
''''''
//最后调用
chain.doFilter(req, res);
```
如果需要对前端加密过来的参数进行解密，那么我们需要对HttpServletRequest进行处理，而上面图关系毫无疑问是一个装饰模式：

>ServletRequest    抽象组件
HttpServletRequest    抽象组件的一个子类
ServletRequestWrapper    一个基本的装饰类，这里是非抽象的
HttpServletRequestWrapper    一个扩展装饰类 兼具体的装饰者

### 4.2 具体实现方案
既然是修改getInputStream()方法的内容，我们可以在HttpServletRequestWrapper 做具体的装饰器

下面具体的代码：
```
public class ParamsWrapperDecorator extends HttpServletRequestWrapper {

    private static final Logger logger = LoggerFactory.getLogger(ParamsWrapperDecorator.class);

    private HttpServletRequest request;

    public ParamsWrapperDecorator(HttpServletRequest request) {
        super(request);
        this.request = request;
    }

    @Override
    public ServletInputStream getInputStream() throws IOException, RoborderException {
        String path = request.getRequestURI();
        //if (new Random().ints(0, 4).boxed().findFirst().orElse(-1) == 1) {
            LoggerUtil.showInfoLogDetails(logger, "IP:{}, 请求地址:{}",Optional.ofNullable(MDC.get("ip")).orElse("unknown"),path);
       // }
        final MethodRule  rule = MethodRule.getEnum(path);
        //处理传入传入参数是否加密
        ServletInputStream is = handleWithParamsDecrypt(rule);
        return is == null ? request.getInputStream() : is;

    }

    private ServletInputStream handleWithParamsDecrypt(final MethodRule rule) throws IOException, RoborderException {
        if (Optional.ofNullable(rule).isPresent() && rule.getParamsDecrypt()) {
           // 大致业务逻辑代码
            BufferedReader reader = request.getReader();
            String encryptData = String.join("", reader.lines().collect(Collectors.toList()));
            reader.close();
           .......................................
            String result;
            EncapDataDTO dto = JSONObject.parseObject(encryptData, EncapDataDTO.class);
            try {
                result = Optional.of(Des3Util.decode(dto.getEncryptData(), secretKey)).orElse("");
                LoggerUtil.showInfoLogDetails(logger, "真实传入参数:{}, 传入参数encaptData:{}, 密钥secretKey:{}", result, encryptData, secretKey);
            } catch (Exception e) {
                LoggerUtil.showErrorDetails(logger, "参数解密失败,加密的数据为:{}", dto.getEncryptData());
                throw new RoborderException(MemberErrorCode.DATA_TRANSFORM_ERROR);
            }
            ByteArrayInputStream is = new ByteArrayInputStream(result.getBytes(Charset.forName("utf8")));

            return new ServletInputStream() {

                @Override
                public boolean isFinished() {
                    return false;
                }
                @Override
                public boolean isReady() {
                    return false;
                }
                @Override
                public void setReadListener(ReadListener listener) {
                }
                @Override
                public int read() throws IOException {
                    return is.read();
                }
            };
        }
        return null;
    }

}
```
定义接口规则枚举类
```
public enum MethodRule {

    start("start", true, true, EncryptType.BASE64, 0),
    Member_registerUser(RequestUrl.Member + RequestUrl.Member_registerUser, false, false, EncryptType.NULL, 0),
    end("end", true, true, EncryptType.RSA, 0);

    private final String url;

    /**
     * 参数是否需要解密
     */
    private final Boolean paramsDecrypt;

    /**
     * 返回结果是否需要加密
     */
    private final Boolean resultEncrypt;

    /**
     * 加密方式
     */
    private final EncryptType signType;

    /**
     * 返回数据是否需要压缩 0 不压缩， 1 压缩
     */
    private final Integer dataCompress;


    MethodRule(String url, Boolean paramsDecrypt, Boolean resultEncrypt, EncryptType signType, Integer dataCompress) {
        this.url = url;
        this.paramsDecrypt = paramsDecrypt;
        this.resultEncrypt = resultEncrypt;
        this.signType = signType;
        this.dataCompress = dataCompress;
    }

    public static MethodRule getEnum(final String url) {
        return Arrays.stream(MethodRule.values()).filter(method -> url.startsWith(method.URL()))
                .findFirst().orElse(null);
    }

    public String URL() {
        return url;
    }

    public Boolean getParamsDecrypt() {
        return paramsDecrypt;
    }

    public Boolean getResultEncrypt() {
        return resultEncrypt;
    }

    public EncryptType getSignType() {
        return signType;
    }

    public Integer getDataCompress() {
        return dataCompress;
    }

}

```
controller层
```
    @ApiOperation(value = "用户注册", notes = "userDTO 可选参数：推荐人userToken  推荐码referralCode，其他为必选参数 ", response = ResultVO.class)
    @RequestMapping(value = RequestUrl.Member_registerUser, method = RequestMethod.POST)
    public ResultObject<ResultVO> registerUser(){
}
```
最后是dofliter中调用
```
 HttpServletRequestWrapper params = new ParamsWrapperDecorator(req);
 ResultWrapperDecorator result = new ResultWrapperDecorator(res);
 chain.doFilter(params, result);
```
这里参数加密解密的介绍，后台返回数据加密 也是一个道理，使用装饰器模式可以很好的解决这个问题
