
---
title: Transaction源码解析之事务预处理
date: 2020-05-11T12:18:15+08:00
weight: 70
slug: spring-transaction-prepare
tags: ["spring-transaction"]
categories: ["spring"]
author: "nicky_chin"
comments: true
share: true
draft: false
---

# 1 调试源码

接上篇[Transaction源码解析之事务的配置解析](https://nicky-chin.cn/2020/05/03/spring-transaction-config/)

我们调用相应的service类,来调试具体的事务处理流程，测试代码如下:

```java

public void testInvokeTransactional() throws Exception {
		TransactionalTestBean testBean = getTestBean();
		CallCountingTransactionManager ptm = (CallCountingTransactionManager) context.getBean("transactionManager");

		// try with transactional
		assertEquals("Should not have any started transactions", 0, ptm.begun);
		testBean.findAllFoos();
		assertEquals("Should have 1 started transaction", 1, ptm.begun);
		assertEquals("Should have 1 committed transaction", 1, ptm.commits);

		// try with non-transaction
		testBean.doSomething();
		assertEquals("Should not have started another transaction", 1, ptm.begun);

		// try with exceptional
		try {
			testBean.exceptional(new IllegalArgumentException("foo"));
			fail("Should NEVER get here");
		}
		catch (Throwable throwable) {
			assertEquals("Should have another started transaction", 2, ptm.begun);
			assertEquals("Should have 1 rolled back transaction", 1, ptm.rollbacks);

		}
	}

```





# 2 事务执行流程

## 2.1 CglibAopProxy动态代理

业务类没有实现接口，所以 **TransactionalTestBean** 会走Cglib动态代理，具体流程在`DynamicAdvisedInterceptor.intercept` 方法中 :

```java
public Object intercept(Object proxy, Method method, Object[] args, MethodProxy methodProxy) throws Throwable {
			Object oldProxy = null;
			boolean setProxyContext = false;
			Class<?> targetClass = null;
			Object target = null;
			try {
			    // 是否需要暴露代理对象
				if (this.advised.exposeProxy) {
           // 基于threadLocal暴露代理对象
					oldProxy = AopContext.setCurrentProxy(proxy);
					setProxyContext = true;
				}
                // 目标对象
                target = getTarget();
				if (target != null) {
					targetClass = target.getClass();
				}
                // 获取拦截器链
                List<Object> chain = this.advised.getInterceptorsAndDynamicInterceptionAdvice(method, targetClass);
				Object retVal;
                // 如果没有拦截器链，则直接调用目标类的方法
                if (chain.isEmpty() && Modifier.isPublic(method.getModifiers())) {

					retVal = methodProxy.invoke(target, args);
				}
				else {
                    // 构造CglibMethodInvocation，递归调用拦截器链
                    retVal = new CglibMethodInvocation(proxy, target, method, args, targetClass, chain, methodProxy).proceed();
				}
                // 返回实施增强之后的调用结果
                retVal = processReturnType(proxy, target, method, retVal);
				return retVal;
			}
			finally {
				if (target != null) {
					releaseTarget(target);
				}
				if (setProxyContext) {
					// Restore old proxy.
					AopContext.setCurrentProxy(oldProxy);
				}
			}
		}
```

## 2.2 获取拦截器

获取拦截器的方法`List<Object> chain = this.advised.getInterceptorsAndDynamicInterceptionAdvice(method, targetClass)`

**遍历所有Advisor，获得MethodInterceptor**

根据Spring的定义，Advice可以是一个MethodInterceptor，也可以是类似于Aspectj的before, after通知。转换由DefaultAdvisorAdapterRegistry.getInterceptors完成:

```java
@Override
public MethodInterceptor[] getInterceptors(Advisor advisor) throws UnknownAdviceTypeException {
    List<MethodInterceptor> interceptors = new ArrayList<MethodInterceptor>(3);
    Advice advice = advisor.getAdvice();
    if (advice instanceof MethodInterceptor) {
        interceptors.add((MethodInterceptor) advice);
    }
    for (AdvisorAdapter adapter : this.adapters) {
        if (adapter.supportsAdvice(advice)) {
            interceptors.add(adapter.getInterceptor(advisor));
        }
    }
    if (interceptors.isEmpty()) {
        throw new UnknownAdviceTypeException(advisor.getAdvice());
    }
    return interceptors.toArray(new MethodInterceptor[interceptors.size()]);
}
```

AdvisorAdapter接口用以支持用户自定义的Advice类型，并将自定义的类型转为拦截器。默认adapters含有**MethodBeforeAdviceAdapter、AfterReturningAdviceAdapter和ThrowsAdviceAdapter**三种类型，用以分别支持**MethodBeforeAdvice、AfterReturningAdvice和ThrowsAdvice**



## 2.3 拦截器链执行



```java
	private static class CglibMethodInvocation extends ReflectiveMethodInvocation {

		private final MethodProxy methodProxy;

		private final boolean protectedMethod;

		public CglibMethodInvocation(Object proxy, Object target, Method method, Object[] arguments,
				Class<?> targetClass, List<Object> interceptorsAndDynamicMethodMatchers, MethodProxy methodProxy) {

			super(proxy, target, method, arguments, targetClass, interceptorsAndDynamicMethodMatchers);
			this.methodProxy = methodProxy;
			this.protectedMethod = Modifier.isProtected(method.getModifiers());
		}

		/**
		 * Gives a marginal performance improvement versus using reflection to
		 * invoke the target when invoking public methods.
		 */
		@Override
		protected Object invokeJoinpoint() throws Throwable {
			// 如果是protect的访问修饰符就执行原生的反射方法
			if (this.protectedMethod) {
				return super.invokeJoinpoint();
			}
			// 否则执行代理
			else {
				return this.methodProxy.invoke(this.target, this.arguments);
			}
		}
	}

@Override
public Object proceed() throws Throwable {
    if (this.currentInterceptorIndex == this.interceptorsAndDynamicMethodMatchers.size() - 1) {
        //拦截器执行完毕，调用原本的方法
        return invokeJoinpoint();
    }
    Object interceptorOrInterceptionAdvice =
            this.interceptorsAndDynamicMethodMatchers.get(++this.currentInterceptorIndex);
    if (interceptorOrInterceptionAdvice instanceof InterceptorAndDynamicMethodMatcher) {
        InterceptorAndDynamicMethodMatcher dm =
                (InterceptorAndDynamicMethodMatcher) interceptorOrInterceptionAdvice;
        if (dm.methodMatcher.matches(this.method, this.targetClass, this.arguments)) {
            return dm.interceptor.invoke(this);
        } else {
            // Dynamic matching failed.
            return proceed();
        }
    } else {
        //调用拦截器的invoke方法
        return ((MethodInterceptor) interceptorOrInterceptionAdvice).invoke(this);
    }
}
```

通过`ReflectiveMethodInvocation.proceed`方法，会执行拦截器截器的`invoke`方法，执行完所有的拦截器方法，最终调用本身方法，这里注意如果本身方法是**protect**访问控制域，则不走代理方法，走本身方法



# 3 事务拦截器

## 3.1 事务基础组件

关于事务相关的拦截器，只需要关注**TransactionInterceptor** 即可，通过`invoke`方法:

```java
@Override
public Object invoke(final MethodInvocation invocation) throws Throwable {
    Class<?> targetClass = (invocation.getThis() != null ? 
             AopUtils.getTargetClass(invocation.getThis()) : null);
    // Adapt to TransactionAspectSupport's invokeWithinTransaction...
    return invokeWithinTransaction(invocation.getMethod(), targetClass, new InvocationCallback() {
        @Override
        public Object proceedWithInvocation() throws Throwable {
            //事务执行完毕后调用链继续向下执行
            return invocation.proceed();
        }
    });
}
```

执行 `invokeWithinTransaction`方法:

```java
	protected Object invokeWithinTransaction(Method method, Class targetClass, final InvocationCallback invocation)
			throws Throwable {

		// If the transaction attribute is null, the method is non-transactional.
		// 获取事务信息
		final TransactionAttribute txAttr = getTransactionAttributeSource().getTransactionAttribute(method, targetClass);
		// 获取事务管理器
		final PlatformTransactionManager tm = determineTransactionManager(txAttr);
		// 得到方法名
		final String joinpointIdentification = methodIdentification(method, targetClass);

		if (txAttr == null || !(tm instanceof CallbackPreferringPlatformTransactionManager)) {
			// Standard transaction demarcation with getTransaction and commit/rollback calls.
            // 事务开启
			TransactionInfo txInfo = createTransactionIfNecessary(tm, txAttr, joinpointIdentification);
			Object retVal = null;
			try {
			
     // 继续执行剩下的advice调用链，最终执行本身方法
				retVal = invocation.proceedWithInvocation();
			}
			catch (Throwable ex) {
				// target invocation exception
				// 异常下提交或者回滚处理
				completeTransactionAfterThrowing(txInfo, ex);
				throw ex;
			}
			finally {
			    // 还原前一个事务的信息到本地线程
				cleanupTransactionInfo(txInfo);
			}
			// 提交事务
			commitTransactionAfterReturning(txInfo);
			return retVal;
		}
```

上面是一个事务执行的完整流程，开始事务 --> 返回执行结果 --> 异常则回滚 --> 执行成功则提交事务并返回

### 3.1.1 事务属性

**TransactionAttribute** 主要用于保存@transacation注解的对应信息

```java
	public TransactionAttribute getTransactionAttribute(Method method, Class<?> targetClass) {
		// First, see if we have a cached value.
		Object cacheKey = getCacheKey(method, targetClass);
		Object cached = this.attributeCache.get(cacheKey);
		// 读取缓存事务属性，缓存没有就解析并放入缓存
		if (cached != null) {
			if (cached == NULL_TRANSACTION_ATTRIBUTE) {
				return null;
			}
			else {
			   // 根据@transacation注解返回对应信息 RuleBasedTransactionAttribute
				return (TransactionAttribute) cached;
			}
		}
		else {
			// 缓存为空
			TransactionAttribute txAtt = computeTransactionAttribute(method, targetClass);
			if (txAtt == null) {
				this.attributeCache.put(cacheKey, NULL_TRANSACTION_ATTRIBUTE);
			}
			else {
				if (logger.isDebugEnabled()) {
					Class<?> classToLog = (targetClass != null ? targetClass : method.getDeclaringClass());
					logger.debug("Adding transactional method '" + classToLog.getSimpleName() + "." +
							method.getName() + "' with attribute: " + txAtt);
				}
				this.attributeCache.put(cacheKey, txAtt);
			}
			return txAtt;
		}
	}
	
	
		private TransactionAttribute computeTransactionAttribute(Method method, Class<?> targetClass) {
		// Don't allow no-public methods as required.
        // 不允许非public访问权限的方法代理
		if (allowPublicMethodsOnly() && !Modifier.isPublic(method.getModifiers())) {
			return null;
		}

		// Ignore CGLIB subclasses - introspect the actual user class.
		Class<?> userClass = ClassUtils.getUserClass(targetClass);
		// The method may be on an interface, but we need attributes from the target class.
		// If the target class is null, the method will be unchanged.
		Method specificMethod = ClassUtils.getMostSpecificMethod(method, userClass);
		// If we are dealing with method with generic parameters, find the original method.
        // 如果我们处理的是一个泛型参数的方法，则获取他的源方法
		specificMethod = BridgeMethodResolver.findBridgedMethod(specificMethod);

		// First try is the method in the target class.
        // 首先在方法上获取事务的属性
		TransactionAttribute txAtt = findTransactionAttribute(specificMethod);
		if (txAtt != null) {
			return txAtt;
		}

		// Second try is the transaction attribute on the target class.
        // 在类上获取事务的属性
		txAtt = findTransactionAttribute(specificMethod.getDeclaringClass());
		if (txAtt != null) {
			return txAtt;
		}

		if (specificMethod != method) {
			// Fallback is to look at the original method.
			txAtt = findTransactionAttribute(method);
			if (txAtt != null) {
				return txAtt;
			}
			// Last fallback is the class of the original method.
			return findTransactionAttribute(method.getDeclaringClass());
		}
		return null;
	}


```

### 3.1.2 事务管理器

**PlatformTransactionManager**  获取事务管理器:

```java
protected PlatformTransactionManager determineTransactionManager(TransactionAttribute txAttr) {
    //如果没有事务属性，那么仅从缓存中查找，找不到返回null
    if (txAttr == null || this.beanFactory == null) {
        return getTransactionManager();
    }
    String qualifier = txAttr.getQualifier();
    //如果@Transactional注解配置了transactionManager或value属性(用以决定使用哪个事务管理器):
    //首先查找缓存，找不到再去容器中按名称寻找
    if (StringUtils.hasText(qualifier)) {
        return determineQualifiedTransactionManager(qualifier);
    } else if (StringUtils.hasText(this.transactionManagerBeanName)) {
        return determineQualifiedTransactionManager(this.transactionManagerBeanName);
    } else {
        //去容器中按类型(Class)查找
        PlatformTransactionManager defaultTransactionManager = getTransactionManager();
        if (defaultTransactionManager == null) {
            defaultTransactionManager = this.beanFactory.getBean(PlatformTransactionManager.class);
            this.transactionManagerCache.putIfAbsent(
                    DEFAULT_TRANSACTION_MANAGER_KEY, defaultTransactionManager);
        }
        return defaultTransactionManager;
    }
}
```

一般我们使用**DataSourceTransactionManager**，类图:

![DataSourceTransactionManager](/media/spring-transaction-prepare/DataSourceTransactionManager-diagram.png)



### 3.1.3 数据源 DataSource

数据源组件，这里不做详细说明，国内比较常见的是**DruidDataSource**




## 3.2 事务的开启及传播

`TransactionAspectSupport.createTransactionIfNecessary`方法用于业务逻辑执行前事务的开启:

```java
	protected TransactionInfo createTransactionIfNecessary(
			PlatformTransactionManager tm, TransactionAttribute txAttr, final String joinpointIdentification) {

		// If no name specified, apply method identification as transaction name.
		// 如果没有指定事务的名称使用方法名
		if (txAttr != null && txAttr.getName() == null) {
			txAttr = new DelegatingTransactionAttribute(txAttr) {
				@Override
				public String getName() {
					return joinpointIdentification;
				}
			};
		}

		TransactionStatus status = null;
		if (txAttr != null) {
			if (tm != null) {
			    // 获取事务状态
				status = tm.getTransaction(txAttr);
			}
			else {
				if (logger.isDebugEnabled()) {
					logger.debug("Skipping transactional joinpoint [" + joinpointIdentification +
							"] because no transaction manager has been configured");
				}
			}
		}
		// 准备事务信息，将当前事务绑定到当前线程
		return prepareTransactionInfo(tm, txAttr, joinpointIdentification, status);
	}

```

这部分代码的核心逻辑在`getTransaction`获取事务状态和`prepareTransactionInfo`准备事务信息

### 3.2.1 事务执行

`getTransaction`主要是用于处理事务的传播行为，没有事务则开启事务:

```java
public final TransactionStatus getTransaction(TransactionDefinition definition) throws TransactionException {
		// 获取包装的connection连接，可能为空
		Object transaction = doGetTransaction();

		// Cache debug flag to avoid repeated checks.
		boolean debugEnabled = logger.isDebugEnabled();

		// 没有事务属性使用默认的属性配置
		if (definition == null) {
			// Use defaults if no transaction definition given.
			definition = new DefaultTransactionDefinition();
		}

        // 是否已存在事务
        if (isExistingTransaction(transaction)) {
            // 如果存在当前事务则处理事务的传播特性
			// Existing transaction found -> check propagation behavior to find out how to behave.
			return handleExistingTransaction(definition, transaction, debugEnabled);
		}

		// Check definition settings for new transaction.
        // 校验超时时间
		if (definition.getTimeout() < TransactionDefinition.TIMEOUT_DEFAULT) {
			throw new InvalidTimeoutException("Invalid transaction timeout", definition.getTimeout());
		}

		// 处理事务的传播级别
        // 当前事务不存在报异常
		// No existing transaction found -> check propagation behavior to find out how to proceed.
		if (definition.getPropagationBehavior() == TransactionDefinition.PROPAGATION_MANDATORY) {
			throw new IllegalTransactionStateException(
					"No existing transaction found for transaction marked with propagation 'mandatory'");
		}
		else if (definition.getPropagationBehavior() == TransactionDefinition.PROPAGATION_REQUIRED ||
				definition.getPropagationBehavior() == TransactionDefinition.PROPAGATION_REQUIRES_NEW ||
			definition.getPropagationBehavior() == TransactionDefinition.PROPAGATION_NESTED) {
			// 挂起
		    SuspendedResourcesHolder suspendedResources = suspend(null);
			if (debugEnabled) {
				logger.debug("Creating new transaction with name [" + definition.getName() + "]: " + definition);
			}
			try {
				boolean newSynchronization = (getTransactionSynchronization() != SYNCHRONIZATION_NEVER);
				// 创建事务状态对象
				DefaultTransactionStatus status = newTransactionStatus(
						definition, transaction, true, newSynchronization, debugEnabled, suspendedResources);
				// 创建一个事务
				doBegin(transaction, definition);
				prepareSynchronization(status, definition);
				return status;
			}
			catch (RuntimeException ex) {
			    // 还原事务挂起前的状态
				resume(null, suspendedResources);
				throw ex;
			}
			catch (Error err) {
				resume(null, suspendedResources);
				throw err;
			}
		}
		else {
		    // 创建一个空事务
			// Create "empty" transaction: no actual transaction, but potentially synchronization.
			boolean newSynchronization = (getTransactionSynchronization() == SYNCHRONIZATION_ALWAYS);
			return prepareTransactionStatus(definition, null, true, newSynchronization, debugEnabled, null);
		}
	}

```



从这里可以得出结论:

**是否存在事务指的是在当前线程、当前数据源(DataSource)中是否存在处于活动状态的事务**。



### 3.2.2 事务不存在创建事务



> 流程: 挂起  --> 创建一个事务 --> 初始化事务同步器 --> 包装返回事务状态



* 1 挂起

```java

protected final SuspendedResourcesHolder suspend(Object transaction) throws TransactionException {
		if (TransactionSynchronizationManager.isSynchronizationActive()) {
		    // 挂起同步器并清空本地线程的同步器
			List<TransactionSynchronization> suspendedSynchronizations = doSuspendSynchronization();
			try {
				Object suspendedResources = null;
        // 如果存在事务
				if (transaction != null) {
				    // 挂起事务，清除本地数据库连接缓存
					suspendedResources = doSuspend(transaction);
				}
				String name = TransactionSynchronizationManager.getCurrentTransactionName();
				TransactionSynchronizationManager.setCurrentTransactionName(null);
				boolean readOnly = TransactionSynchronizationManager.isCurrentTransactionReadOnly();
				TransactionSynchronizationManager.setCurrentTransactionReadOnly(false);
				Integer isolationLevel = TransactionSynchronizationManager.getCurrentTransactionIsolationLevel();
				TransactionSynchronizationManager.setCurrentTransactionIsolationLevel(null);
				boolean wasActive = TransactionSynchronizationManager.isActualTransactionActive();
				TransactionSynchronizationManager.setActualTransactionActive(false);
				return new SuspendedResourcesHolder(
						suspendedResources, suspendedSynchronizations, name, readOnly, isolationLevel, wasActive);
			}
			catch (RuntimeException ex) {
				// doSuspend failed - original transaction is still active...
                // 挂起失败还原之前的同步器
				doResumeSynchronization(suspendedSynchronizations);
				throw ex;
			}
			catch (Error err) {
				// doSuspend failed - original transaction is still active...
				doResumeSynchronization(suspendedSynchronizations);
				throw err;
			}
		}
		else if (transaction != null) {
			// Transaction active but no synchronization active.
			Object suspendedResources = doSuspend(transaction);
			return new SuspendedResourcesHolder(suspendedResources);
		}
		else {
			// Neither transaction nor synchronization active.
			return null;
		}
	}


```

主要是清空基于_ThreadLocal_的本地线程绑定的事务信息，并将清空的事务信息存入**SuspendedResourcesHolder**挂起资源对象中返回



* 2 创建一个事务

```java

	protected void doBegin(Object transaction, TransactionDefinition definition) {
		//此时，txObject不为null，只是其核心的ConnectHolder属性为null
		DataSourceTransactionObject txObject = (DataSourceTransactionObject) transaction;
		Connection con = null;

		try {
			if (txObject.getConnectionHolder() == null ||
					txObject.getConnectionHolder().isSynchronizedWithTransaction()) {
			    // 获取数据库新连接
				Connection newCon = this.dataSource.getConnection();
				if (logger.isDebugEnabled()) {
					logger.debug("Acquired Connection [" + newCon + "] for JDBC transaction");
				}
                // 可以看出ConnectionHolder是对Connection的包装
				txObject.setConnectionHolder(new ConnectionHolder(newCon), true);
			}

			txObject.getConnectionHolder().setSynchronizedWithTransaction(true);
			con = txObject.getConnectionHolder().getConnection();
            //设置是否只读和隔离级别
            Integer previousIsolationLevel = DataSourceUtils.prepareConnectionForTransaction(con, definition);
			txObject.setPreviousIsolationLevel(previousIsolationLevel);
            // 将自动提交设置为false
			if (con.getAutoCommit()) {
				txObject.setMustRestoreAutoCommit(true);
				if (logger.isDebugEnabled()) {
					logger.debug("Switching JDBC Connection [" + con + "] to manual commit");
				}
				con.setAutoCommit(false);
			}
			// 设置事务为存活状态
			txObject.getConnectionHolder().setTransactionActive(true);
			// 设置超时时间点
			int timeout = determineTimeout(definition);
			if (timeout != TransactionDefinition.TIMEOUT_DEFAULT) {
				txObject.getConnectionHolder().setTimeoutInSeconds(timeout);
			}

			// Bind the session holder to the thread.
            // 绑定事务属性到本地数据源
			if (txObject.isNewConnectionHolder()) {
				TransactionSynchronizationManager.bindResource(getDataSource(), txObject.getConnectionHolder());
			}
		}

		catch (Throwable ex) {
		    // 如果是新事务则释放连接
			if (txObject.isNewConnectionHolder()) {
				DataSourceUtils.releaseConnection(con, this.dataSource);
				txObject.setConnectionHolder(null, false);
			}
			throw new CannotCreateTransactionException("Could not open JDBC Connection for transaction", ex);
		}
	}


```

上述创建事务主要逻辑：

> 1 创建一个新连接
>
> 2 设置隔离级别和是否只读
>
> 3 设置超时时间和手动提交
>
> 4 绑定事务数据源到本地线程
>
> 5 异常释放连接

逻辑很清晰，为了connection数据源的创建并绑定到本地线程



* 3 初始化事务同步器

```java

	protected void prepareSynchronization(DefaultTransactionStatus status, TransactionDefinition definition) {
		if (status.isNewSynchronization()) {
			TransactionSynchronizationManager.setActualTransactionActive(status.hasTransaction());
			TransactionSynchronizationManager.setCurrentTransactionIsolationLevel(
					(definition.getIsolationLevel() != TransactionDefinition.ISOLATION_DEFAULT) ?
							definition.getIsolationLevel() : null);
			TransactionSynchronizationManager.setCurrentTransactionReadOnly(definition.isReadOnly());
			TransactionSynchronizationManager.setCurrentTransactionName(definition.getName());
			TransactionSynchronizationManager.initSynchronization();
		}
	}

```

将要将事务的存活状态，隔离级别，是否只读的信息绑定到本地线程，并初始化同步器




* 4  异常还原事务信息

```java
	protected final void resume(Object transaction, SuspendedResourcesHolder resourcesHolder)
			throws TransactionException {

		if (resourcesHolder != null) {
			Object suspendedResources = resourcesHolder.suspendedResources;
			if (suspendedResources != null) {
				doResume(transaction, suspendedResources);
			}
			List<TransactionSynchronization> suspendedSynchronizations = resourcesHolder.suspendedSynchronizations;
			if (suspendedSynchronizations != null) {
				TransactionSynchronizationManager.setActualTransactionActive(resourcesHolder.wasActive);
				TransactionSynchronizationManager.setCurrentTransactionIsolationLevel(resourcesHolder.isolationLevel);
				TransactionSynchronizationManager.setCurrentTransactionReadOnly(resourcesHolder.readOnly);
				TransactionSynchronizationManager.setCurrentTransactionName(resourcesHolder.name);
				doResumeSynchronization(suspendedSynchronizations);
			}
		}
	}

```

异常情况主要是重新将当前线程绑定到上一个事务的信息



### 3.2.3 事务已存在传播事务



如果检测到已存在事务，则需要处理事务的传播特性，具体看`AbstractPlatformTransactionManager.handleExistingTransaction`方法:

* 1 PROPAGATION_NEVER

即当前方法需在非事务环境下执行，如果有事务存在，则抛出异常:

```java
if (definition.getPropagationBehavior() == TransactionDefinition.PROPAGATION_NEVER) {
    throw new IllegalTransactionStateException(
        "Existing transaction found for transaction marked with propagation 'never'");
}
```



* 2 PROPAGATION_NOT_SUPPORTED

如果有事务存在，那么将事务挂起:

```java
if (definition.getPropagationBehavior() == TransactionDefinition.PROPAGATION_NOT_SUPPORTED) {
    Object suspendedResources = suspend(transaction);
    boolean newSynchronization = (getTransactionSynchronization() == SYNCHRONIZATION_ALWAYS);
    return prepareTransactionStatus(
        definition, null, false, newSynchronization, debugEnabled, suspendedResources);
}
```



事务挂起`suspend`方法上面已分析，最终调用`TransactionSynchronizationManager.doUnbindResource`:

```java
private static Object doUnbindResource(Object actualKey) {
    Map<Object, Object> map = resources.get();
    if (map == null) {
        return null;
    }
    Object value = map.remove(actualKey);
    // Remove entire ThreadLocal if empty...
    if (map.isEmpty()) {
        resources.remove();
    }
    // Transparently suppress a ResourceHolder that was marked as void...
    if (value instanceof ResourceHolder && ((ResourceHolder) value).isVoid()) {
        value = null;
    }
    return value;
}
```

可以看出，事务挂起做了移除当前线程、数据源活动事务对象的过程



* 3 PROPAGATION_REQUIRES_NEW

​     挂起当前事务，并创建一个新事务

```java
	// 挂起当前活动事务并创建新事务的过程
		if (definition.getPropagationBehavior() == TransactionDefinition.PROPAGATION_REQUIRES_NEW) {
			if (debugEnabled) {
				logger.debug("Suspending current transaction, creating new transaction with name [" +
						definition.getName() + "]");
			}
			SuspendedResourcesHolder suspendedResources = suspend(transaction);
			try {
				boolean newSynchronization = (getTransactionSynchronization() != SYNCHRONIZATION_NEVER);
				DefaultTransactionStatus status = newTransactionStatus(
						definition, transaction, true, newSynchronization, debugEnabled, suspendedResources);
				// 开始新事务
				doBegin(transaction, definition);
			    // 初始化事务同步器
				prepareSynchronization(status, definition);
				return status;
			}
			catch (RuntimeException beginEx) {
			    // 还原挂起的事务
				resumeAfterBeginException(transaction, suspendedResources, beginEx);
				throw beginEx;
			}
			catch (Error beginErr) {
				resumeAfterBeginException(transaction, suspendedResources, beginErr);
				throw beginErr;
			}
		}
		
```

可以看出，这部分逻辑和创建新事务基本相同



* 4 PROPAGATION_NESTED

> 开始一个 嵌套的事务,  它是已经存在事务的一个真正的子事务. 嵌套事务开始执行时,  它将取得一个 savepoint. 如果这个嵌套事务失败, 我们将回滚到此 savepoint. 嵌套事务是外部事务的一部分, 只有外部事务结束后它才会被提交. 

具体代码逻辑: 

```java
	// 嵌套事务
		if (definition.getPropagationBehavior() == TransactionDefinition.PROPAGATION_NESTED) {
			if (!isNestedTransactionAllowed()) {
				throw new NestedTransactionNotSupportedException(
						"Transaction manager does not allow nested transactions by default - " +
						"specify 'nestedTransactionAllowed' property with value 'true'");
			}
			if (debugEnabled) {
				logger.debug("Creating nested transaction with name [" + definition.getName() + "]");
			}
			// 是否使用savepoint
			if (useSavepointForNestedTransaction()) {
				// Create savepoint within existing Spring-managed transaction,
				// through the SavepointManager API implemented by TransactionStatus.
				// Usually uses JDBC 3.0 savepoints. Never activates Spring synchronization.
				DefaultTransactionStatus status =
						prepareTransactionStatus(definition, transaction, false, false, debugEnabled, null);
				status.createAndHoldSavepoint();
				return status;
			}
			else {
				// Nested transaction through nested begin and commit/rollback calls.
				// Usually only for JTA: Spring synchronization might get activated here
				// in case of a pre-existing JTA transaction.
				boolean newSynchronization = (getTransactionSynchronization() != SYNCHRONIZATION_NEVER);
				DefaultTransactionStatus status = newTransactionStatus(
						definition, transaction, true, newSynchronization, debugEnabled, null);
				doBegin(transaction, definition);
				// 初始化事务同步器
				prepareSynchronization(status, definition);
				return status;
			}
		}
		
```

嵌套事务如果使用savepoint则会通过数据库本身实现的安全点处理。否则会创建一个新的事务



## 3.3 绑定事务

  通过`TransactionAspectSupport.prepareTransactionInfo`准备事务信息，将当前事务绑定到当前线程：

```java
	protected TransactionInfo prepareTransactionInfo(PlatformTransactionManager tm,
			TransactionAttribute txAttr, String joinpointIdentification, TransactionStatus status) {

		TransactionInfo txInfo = new TransactionInfo(tm, txAttr, joinpointIdentification);
		if (txAttr != null) {
			// We need a transaction for this method
			if (logger.isTraceEnabled()) {
				logger.trace("Getting transaction for [" + txInfo.getJoinpointIdentification() + "]");
			}
			// The transaction manager will flag an error if an incompatible tx already exists
			txInfo.newTransactionStatus(status);
		}
		else {
		
			if (logger.isTraceEnabled())
				logger.trace("Don't need to create transaction for [" + joinpointIdentification +
						"]: This method isn't transactional.");
		}

    // 保存上一个事务信息和当前事务信息到对象中
		txInfo.bindToThread();
		return txInfo;
	}

	private void bindToThread() {
			// Expose current TransactionStatus, preserving any existing TransactionStatus
			// for restoration after this transaction is complete.
			this.oldTransactionInfo = transactionInfoHolder.get();
			transactionInfoHolder.set(this);
		}


```

意图很明显，就是将当前事务绑定到本地线程，同时将上一级的事务存放到_oldTransactionInfo_属性中，为什么要这么做呢，这个请看之后的事务提交部分的解析



# 4 Reference

[spring 嵌套事务分析](http://www.iteye.com/topic/35907)

