---
title: 实际项目运用之Strategy模式（策略模式）
date: 2018-05-06T11:18:15+08:00
weight: 70
slug: strategy
tags: ["行为型"]
categories: ["design-pattern"]
author: "nicky_chin"
comments: true
share: true
draft: false
---


# 1. 策略模式概要
策略模式是对算法的包装，是把使用算法的责任和算法本身分割开来，委派给不同的对象管理。策略模式通常把一个系列的算法包装到一系列的策略类里面，作为一个抽象策略类的子类。用一句话来说，就是：“准备一组算法，并将每一个算法封装起来，使得它们可以互换”。
下面就以一个示意性的实现讲解策略模式实例的结构。
![策略模式](https://upload-images.jianshu.io/upload_images/10175660-2d9b5e02ce921d8e.jpg?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)


　　这个模式涉及到三个角色：

　　● **环境(Context)角色：**持有一个Strategy的引用。

　　● **抽象策略(Strategy)角色：**这是一个抽象角色，通常由一个接口或抽象类实现。此角色给出所有的具体策略类所需的接口。

　　● **具体策略(ConcreteStrategy)角色：**包装了相关的算法或行为。

### 1.1 案例代码
策略模式上下文
```
public class Context {
    //持有一个具体策略的对象
    private Strategy strategy;
    /**
     * 构造函数，传入一个具体策略对象
     * @param strategy    具体策略对象
     */
    public Context(Strategy strategy){
        this.strategy = strategy;
    }
    /**
     * 策略方法
     */
    public void contextInterface(){
        strategy.algorithmInterface();
    }
}
```
抽象策略类
```
public interface Strategy {
    /**
     * 策略方法
     */
    public void algorithmInterface();
}
```
具体策略类
```
public class ConcreteStrategyA implements Strategy {

    @Override
    public void  algorithmInterface() {
        //相关的业务
    }

}

public class ConcreteStrategyB implements Strategy {

    @Override
    public void  algorithmInterface() {
        //相关的业务
    }

}

public class ConcreteStrategyC implements Strategy {

    @Override
    public void  algorithmInterface() {
        //相关的业务
    }

}
```
客户端
```
//选择使用的策略
Strategy s = new ConcreteStrategyA();
Context context = new Context(s);
context.ontextInterface()；
```
### 1.2 策略模式优缺点

**策略模式的优点**：
	算法可以自由切换；
	避免使用多重条件判断；
	扩展性良好。

**策略模式的缺点：**
	策略类会增多
	所有策略类都需要对外暴露

**策略模式的适用场景：**
	当一个系统中有许多类，它们之间的区别仅在于它们的行为，希望动态地让一个对象在许多行为中选择一种行为时；
	当一个系统需要动态地在几种算法中选择一种时；
	当一个对象有很多的行为，不想使用多重的条件选择语句来选择使用哪个行为时。


# 2. 应用场景
### 2.1 Java 对象排序中的应用
**Comparator 外部比较器接口**
我们如果需要控制某个类的次序，而该类本身不支持排序（即没有实现Comparable接口）；那么可以建立一个该类的比较器来排序，这个比较器只需要实现Comparator接口即可。,通过实现Comparator类来新建一个比较器，然后通过该比较器来对类进行排序。Comparator 接口其实就是一种策略模式的实践
事例代码：
**抽象策略类 Comparator** 
```
public interface Comparator<T> {
    int compare(T o1, T o2);
    boolean equals(Object obj);
 }
```
**具体策略类 SortComparator**
```
public class SortComparator implements Comparator {

    @Override
    public int compare(Object o1, Object o2) {
        Student student1 = (Student) o1;
        Student student2 = (Student) o2;
        return student1.getAge() - student2.getAge();
    }
}
```

**策略模式上下文 Collections**
```
public class Client {

    public static void main(String[] args) {

        Student stu[] = {
                new Student("张三" ,23),
                new Student("李四" ,26)
                , new Student("王五" ,22)};
        Arrays. sort(stu,new SortComparator());
        System.out.println(Arrays.toString(stu));

        List<Student> list = new ArrayList<>(3);
        list.add( new Student("zhangsan" ,31));
        list.add( new Student("lisi" ,30));
        list.add( new Student("wangwu" ,35));
        Collections. sort(list,new SortComparator());
        System.out.println(list);

    }

}
```

**数据流**
```
countRunAndMakeAscending:355, TimSort (java.util)
sort:220, TimSort (java.util)
sort:1438, Arrays (java.util)
main:20, Client (designpattern.strategy.compare)
```
调用Collections.sort方法之后走的是Arrays.sort()方法，然后TimSort类中countRunAndMakeAscending方法中调用具体比较器的算法实现进行比较，完成排序。这是大家比较常用的对象排序工具类。


###2.2 实际项目中的应用
**功能背景**
在我们公司的应用程序中有一个app分享功能，目前暂定可以分享到 【朋友圈，微信好友，sina，qq】四个地方，分享所需的内容包含 【标题， 分享图片，分享内容， 分享链接】，产品经理不能确定是否后续会添加新的 分享入口，比如 支付宝 ，qq空间，对于产品的内容也不是固定的，也许会增加其他内容，如果我们按常规设计类，我们要设计四个类，如果内容模版有变动需要在方法中修改，如果加入了其他内容属性，之前设计的代码时间就浪费了。
既然是分享模版可以当成一种算法策略，我就联想到了使用策略模式。

抽象策略类
```
/**
 * 标题
 */
public interface ShareTitle {

    String showTitle();
}

/**
 * 分享内容
 */
public interface ShareContent {

    String showContent();
}

/**
 * 缩略图
 */
public interface ShareImageUrl {

    String showImageUrl(final String platform);

}

/**
 * 分享链接
 */
public interface ShareLink {

    String getShareLink(final String platform, final String userToken);

}

```
具体抽象类 以微信好友分享为例
```
/**
 * 微信标题
 */
public class WechatTitle implements ShareTitle {

    @Override
    public String showTitle() {
        return BundleUtil.getResult("share.wechat.title");
    }
}

/**
 * 微信分享内容
 */
public class WechatContent implements ShareContent {

    @Override
    public String showContent() {
        return BundleUtil.getResult("share.wechat.content");
    }
}

/**
 * 微信缩略图
 */
public class WechatImageUrl implements ShareImageUrl {

    @Override
    public String showImageUrl(final String platform) {
        return BundleUtil.getResult("share.wechat.image.url." + platform);
    }
}

/**
 * 微信分享链接
 */
public class WechatShareLink implements ShareLink {

    @Override
    public String getShareLink(final String platform, final String userToken) {
        return BundleUtil.getResult("share.wechat.link." + platform) + userToken;
    }
}

/**
 * 微信分享
 */
public class WechatShare extends ShareContext {

    public WechatShare() {
        super.shareTitle = new WechatTitle();
        super.shareContent = new WechatContent();
        super.shareImageUrl = new WechatImageUrl();
        super.shareLink = new WechatShareLink();
    }

}
```
其实上面具体策略的拆分和建造者模式相似了，在代码中我使用了*BundleUtil.getResult（）*这个方法，该方法可以读取配置文件，这样可以方便具体内容的修改，而不需要修改类代码。

具体resource下面的properties文件中的参数配置如下：
```
share.wechat.title=这个APP竟然这么棒
share.wechat.content=还不快来加入我们旅游派对
share.wechat.link.android=https://www.666.com/salesman/shareRegister?android&userToken=
share.wechat.link.ios=https://www.666.com/salesman/shareRegister?ios&userToken=
share.wechat.image.url.android=android wechat img url
share.wechat.image.url.ios=ios wechat img url

1=com.nicky.facade.sharestrategy.targets.QQShare
```
这样，如果模版的内容发生变动，我只需在配置文件中修改即可。

然后是策略模式上下文
```
public class ShareContext {

    protected ShareTitle shareTitle;

    protected ShareContent shareContent;

    protected ShareImageUrl shareImageUrl;

    protected ShareLink shareLink;

    public static ShareContext getShareTarget(Integer type) {
        String className = BundleUtil.getResult(type.toString());
        Class cls;
        try {
            cls = Class.forName(className);
            return (ShareContext) cls.newInstance();
        } catch (ReflectiveOperationException e) {
            e.printStackTrace();
        }
        return null;
    }

    public final String showTitle() {
        return shareTitle.showTitle();
    }

    public final String showContent() {
        return shareContent.showContent();
    }

    public final String displayImageUrl(final String platform) {
        return shareImageUrl.showImageUrl(platform);
    }

    public final String displayShareLinkUrl(final String platform, final String  userToken) {
        return shareLink.getShareLink(platform, userToken);
    }

    public static ShareInfo getShareInfo(ShareContext context, String platform, String userToken) {
        ShareInfo info = new ShareInfo();
        info.setContent(context.showContent());
        info.setImageUrl(context.displayImageUrl(platform));
        info.setTitle(context.showTitle());
        info.setShareLink(context.displayShareLinkUrl(platform, userToken));
        return info;
    }
}

```
getShareTarget方法中通过反射的方式去获取对象，从而避免增加分享渠道的时候，修改方法中的代码，符合开闭原则



客户端
```
    public static void main(String[] args) throws Exception {
        ShareContext context = ShareContext
                .getShareTarget(1);
        System.out.println(context.showContent());
        System.out.println(context.showTitle());
        System.out.println(context.displayImageUrl("android"));
        System.out.println(context.displayShareLinkUrl("ios", "?#"));
    }

```
比如我们协定传入参数1表示微信分享，相当于指定了分享的模版策略。打印的结果类似如下
```
还不快来加入我们旅游派对
这个APP竟然这么棒
"android qq img url
https:///www.666.com/salesman/shareRegister?ios&userToken=?#
```
当然当前的设计是存在缺陷的，如果内容的组成有新增一个分享属性，还是需要修改类中的构造器对象，所以我们可以通过builder模式去优化策略模式。

如不了解builder模式，请查看 -----> [设计模式之builder模式](https://www.jianshu.com/p/63e1a821e26c)


项目中运用策略模式的场景很多，比如不同会员等级购买产品价格计算，比如对不同消费用户做内容营销的时候，都是可以使用策略模式来解决问题的。

