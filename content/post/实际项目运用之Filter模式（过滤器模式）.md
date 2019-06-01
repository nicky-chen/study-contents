---
title: 实际项目运用之Filter模式（过滤器模式）
date: 2019-02-15T11:18:15+08:00
weight: 70
slug: filter
tags: ["结构型"]
categories: ["design-pattern"]
author: "nicky_chin"
comments: true
share: true
draft: false
---


## 1 模式简介

#### 1.1 定义
过滤器模式（Filter）也叫条件模式（Criteria），这种模式允许开发人员使用不同的标准来过滤一组对象，通过逻辑运算以解耦的方式把它们连接起来。当我们想要选择满足一个或多个条件的对象子集时，此设计模式非常有用。它属于结构模式。

#### 1.2 优点

> 它提供了一种根据特定条件过滤对象的方法
> 
> 我们可以随时添加新过滤器，而不会影响客户端的代码
> 
> 我们可以在程序执行期间动态选择过滤器


#### 1.3 过滤器设计

![过滤器类图](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190601150313.png)


**角色**

* 过滤器（Filter） - 过滤器在请求处理程序执行请求之前或之后，执行某些任务
* 过滤器链（Filter Chain） - 过滤器链带有多个过滤器
* 过滤对象 （Target）- 需要过滤的数据源对象
* 过滤管理器（Filter Manager） - 过滤管理器管理过滤器和过滤器链
* 客户端（Client） - Client 是向 Target 对象发送请求的对象


代码演示

_Filter_

```
public interface Filter {
   public void execute(String request);
}

```


_AuthenticationFilter_


```

public class AuthenticationFilter implements Filter {
   public void execute(String request){
      System.out.println("Authenticating request: " + request);
   }
}

```

_FilterChain_

```
public class FilterChain {
   private List filters = new ArrayList();
   
   public void addFilter(Filter filter){
      filters.add(filter);
   }

   public void execute(String request){
      for (Filter filter : filters) {
         filter.execute(request);
      }
   }
}

```

_FilterManager_


```
public class FilterManager {
   FilterChain filterChain;

   public FilterManager(){
      filterChain = new FilterChain();
   }
   public void setFilter(Filter filter){
      filterChain.addFilter(filter);
   }

   public void filterRequest(String request){
      filterChain.execute(request);
   }
}


```

_Client_


```java
public class Client {

  public static void main(String[] args) {
      FilterManager filterManager = new FilterManager();
      filterManager.setFilter(new AuthenticationFilter());
      filterManager.setFilter(new DebugFilter());
      filterManager.sendRequest("HOME");
   }
}

```



## 2 Filter在MongoTemplate中的应用

```
Query query = new Query();            

query.addCriteria(Criteria.where("gmtCreate").gte(gmtBegin).lte("gmtCreate").lte(gmtEnd));

query.addCriteria(Criteria.where("wechatName").is(wxName));
 
long count =  mongoTemplate.count(query, User.class);

```

上述代码是非常常用的mongo查询的用法。其中 `Criteria` 可以理解就是过滤器对象， `Query` 就是过滤管理器和过滤器链的组合


* 过滤器 **CriteriaDefinition**

```
public interface CriteriaDefinition {

	/**
	 * Get {@link DBObject} representation.
	 * 
	 * @return
	 */
	DBObject getCriteriaObject();

	/**
	 * Get the identifying {@literal key}.
	 * 
	 * @return
	 * @since 1.6
	 */
	String getKey();

}

```
`SpringMongoTemplate` 是基于Mongo的驱动包封装的, `CriteriaDefinition` 是where条件部分，最终通过`DBObject`的对象去执行where部分的命令

* 具体过滤器对象

```
public class Criteria implements CriteriaDefinition {

	/**
	 * Custom "not-null" object as we have to be able to work with {@literal null} values as well.
	 */
	private static final Object NOT_SET = new Object();

	private String key;
	private List<Criteria> criteriaChain;
	private LinkedHashMap<String, Object> criteria = new LinkedHashMap<String, Object>();
	private Object isValue = NOT_SET;
	
	
	}
```

* 1  `Criteria` 对象包含一个Map属性	`private LinkedHashMap<String, Object> criteria = new LinkedHashMap<String, Object>()`, 例如之前我们调用的方法，`query.addCriteria(Criteria.where("gmtCreate").gte(1000L).lte("gmtCreate").lte(2000000L))` 会加入到LinkedHashMap对象中。


* 2  通过`query.addCriteria` 增加过滤器 

```
public class Query {

	private static final String RESTRICTED_TYPES_KEY = "_$RESTRICTED_TYPES";

	private final Set<Class<?>> restrictedTypes = new HashSet<Class<?>>();
	private final Map<String, CriteriaDefinition> criteria = new LinkedHashMap<String, CriteriaDefinition>();
	private Field fieldSpec;
	private Sort sort;
	private int skip;
	private int limit;
	private String hint;

	private Meta meta = new Meta();


................此处省略

	/**
	 * Adds the given {@link CriteriaDefinition} to the current {@link Query}.
	 * 
	 * @param criteriaDefinition must not be {@literal null}.
	 * @return
	 * @since 1.6
	 */
	public Query addCriteria(CriteriaDefinition criteriaDefinition) {

		CriteriaDefinition existing = this.criteria.get(criteriaDefinition.getKey());
		String key = criteriaDefinition.getKey();

		if (existing == null) {
			this.criteria.put(key, criteriaDefinition);
		} else {
			throw new InvalidMongoDbApiUsageException(
					"Due to limitations of the com.mongodb.BasicDBObject, " + "you can't add a second '" + key + "' criteria. "
							+ "Query already contains '" + existing.getCriteriaObject() + "'.");
		}

		return this;
	}
	
	..........
	}

```
如上面的代码，过滤器会被加入到一个Map对象中，最终会将Query对象转换成DBObject对象，然后通过
Mongo的驱动包去获取数据，这里不详细展开。


* 类图如下：

![mongoTemplate过滤查询流程](https://raw.githubusercontent.com/nicky-chen/pic_store/master/%E5%B1%8F%E5%B9%95%E5%BF%AB%E7%85%A7%202019-06-01%20%E4%B8%8B%E5%8D%888.18.46.png)

大致流程如上图所示，结合具体代码，很容易理解是一个基于命令的过滤器模式






## 3 实际项目运用

#### 3.1 应用背景

在我们的app有这样一种需求，我们需要展示一个豆腐块列表，但是我们不知道需要怎么展示，比如，我们可以隐藏部分展示，也可以自定义展示时间和展示顺序，或者可以按照平台PC 安卓 IOS 展示不同数据，或者其他一些字体颜色等参数的使用，这时候我们需要一定过滤条件去获取最终可以展示的图标，这时候我们就可以考虑过滤器模式去实现

#### 3.2 通用实现逻辑

##### 3.2.1 设计类图

![过滤器实际业务设计类图](https://raw.githubusercontent.com/nicky-chen/pic_store/master/%E5%B1%8F%E5%B9%95%E5%BF%AB%E7%85%A7%202019-06-01%20%E4%B8%8B%E5%8D%883.49.47.png)


其中 `RuleFilter` 负责过滤器抽象的职能， `RuleContext` 负责过滤器链和过滤管理器的职能 


##### 3.2.2 代码实现


* 过滤器： _RuleFilter_ 

```

/**
 * @author nicky_chin
 * @description: 规则过滤器
 * @date: 2019/4/4 下午5:41
 * @since JDK 1.8
 */
public interface RuleFilter<T> {

    /**
     * 过滤数据
     *
     * @param ruleList
     *
     * @return
     */
    List<T> filterData(List<T> ruleList);
}

```

* 具体过滤器： _ComparatorFilter_  和 _DisplayFilter_

```
/**
 * @author nicky_chin
 * @description: 排序过滤器
 * @date: 2019/4/4 下午5:58
 * @since JDK 1.8
 */
public class ComparatorFilter implements RuleFilter<PropertyRule> {
    @Override
    public List<PropertyRule> filterData(List<PropertyRule> ruleList) {
        return ruleList.stream().sorted(Comparator.comparingInt(PropertyRule::getIndex)).collect(Collectors.toList());
    }
}


/**
 * @author nicky_chin
 * @description: 显示过滤器
 * @date: 2019/4/4 下午5:56
 * @since JDK 1.8
 */
@NoArgsConstructor
@AllArgsConstructor
public class DisplayFilter implements RuleFilter<PropertyRule> {

    /**
     * 用户参数显示配置
     */
    private Integer binaryStatus;

    @Override
    public List<PropertyRule> filterData(List<PropertyRule> ruleList) {
        if (binaryStatus != null) {
            for (int i = 0; i < ruleList.size(); i++) {
                PropertyRule config = ruleList.get(i);
                //获取是否需要展示数据
                config.setDisplayStatus(
                    ONE.equals(config.getDisplayStatus()) && (binaryStatus & (1 << i)) >> i == 1 ? ONE : ZERO);
            }
        }
        return ruleList.stream().filter(x -> StringPool.ONE.equals(x.getDisplayStatus())).collect(Collectors.toList());
    }
}


```

* _PropertyRule_  过滤对象

```
/**
 * @author nicky_chin
 * @description: 详情规则
 * @date: 2019/4/3 下午6:35
 * @since JDK 1.8
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PropertyRule {

    /**
     * 英文属性名
     */
    private String key;

    /**
     * 中文属性名
     */
    private String chsKey;

    /**
     * 属性值
     */
    private Object value;

    /**
     * 是否显示
     */
    private String displayStatus;
    /**
     * 排序号
     */
    private int index;

    /**
     * 图标地址
     */
    private String iconUrl;

    /**
     * 单位
     */
    private String unit;
}

```



* 过滤器链： _RuleBuilder_ 使用建造者模式创建
* 过滤管理器： _RuleContext_

`RuleContext` 包含了过滤器链和过滤管理器的职能

```
/**
 * @author nicky_chin
 * @description:过滤执行器
 * @date: 2019/4/4 下午5:55
 * @since JDK 1.8
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RuleContext {

    private List rules;

    private List<RuleFilter> filterList;

    private RuleContext(RuleBuilder builder) {
        this.filterList = builder.filterList;
    }

    /**
     * 规则建造器
     * @param rules
     * @return
     */
    public static RuleBuilder rules(List rules) {
        return new RuleBuilder().addRules(rules);
    }

    public static class RuleBuilder {

        @Setter(value = AccessLevel.PRIVATE)
        private List rules;

        private List<RuleFilter> filterList;

        public RuleBuilder addFilter(RuleFilter filter) {
            filterList.add(filter);
            return this;
        }

        private RuleBuilder addRules(List rules) {
            this.setRules(rules);
            this.filterList = Lists.newArrayList();
            return this;
        }

        /**
         * 执行过滤
         * @param returnType
         * @param <C>
         * @param <T>
         * @return
         */
        public <C extends List<T>, T> C invokerFilter(@NonNull Class<T> returnType) {
            RuleContext ruleContext = new RuleContext(this);
            ruleContext.setRules(rules);
            ruleContext.setFilterList(filterList);
            ruleContext.getFilterList().forEach(filter -> {
                List rules = ruleContext.getRules();
                if (CollectionUtils.isNotEmpty(rules)) {
                    ruleContext.setRules(filter.filterData(rules));
                }
            });
            return TypeConverterManager.get().convertToCollection(ruleContext.getRules(), List.class, returnType);
        }
    }

}

```

其中 `addFilter` 用于创建过滤器链， `addRules` 方法用于装载过滤元数据，最后通过 `invokerFilter` 方法来执行过滤器链


* 客户端

```
List<PropertyRule> keyValueList = rule.getProperties();
keyValueList = RuleContext.rules(keyValueList).addFilter(new DisplayFilter(binaryStatus)).addFilter(new ComparatorFilter())
                .invokerFilter(PropertyRule.class);

```
这样就可以根据需要 *显示的规则* 和 *排序规则* 筛选出我们最终需要的数据配置

##### 3.2.3 设计优点

> 基于建造者模式和过滤器模式的方式简化了过滤业务逻辑
>
> 过滤器和过滤对象通过接口和泛型的方式抽象，支持各种业务的良好扩展
>
> 通过动态选择过滤器组合，可复用过滤器和减少重复过滤代码的维护


## 4 Reference
[拦截过滤器模式
](https://m.w3cschool.cn/shejimoshi/intercepting-filter-pattern.html)