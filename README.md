# 目录结构
```
src/
│
├── core/             # Engine 相关
│   ├── engine.ts       # 核心引擎，启动整个回测、模拟盘、实盘
│   ├── event-bus.ts    # 事件驱动模块 EventBus 实现
│
├── statistics/                # 数据源模块
│   ├── base-statistics.ts     # 数据统计基类
│   ├── db-statistics.ts       # 数据统计带数据库存储
│
├── feed/                # 数据源模块
│   ├── base-feed.ts     # 基础 Feed 类
│   ├── backtest-feed.ts # 回测 Feed 类
│   ├── ccxt-feed.ts     # 用于实际的交易所数据源
│
├── commission/               # 手续费/佣金模块
│   ├── base-commission.ts    # 基础 commission 接口
│   ├── percent-commission.ts # 百分比 commission 类
│
├── broker/             # 经纪商模块
│   ├── base-broker.ts  # 基础 Broker 类
│   ├── mock-broker.ts  # 模拟的 Broker
│
├── strategy/            # 策略模块
│   ├── base-strategy.ts # 策略基类
│   ├── bollinger.ts     # 简单的策略实现(布林带)
│
└── utils/              # 工具函数
    ├── console.ts      # 日志模块
    └── types.ts        # 相关类型
```

# 事件
-  order:fill 订单填充
-  balance:init 初始余额
-  balance:update 余额更新
-  balance:insufficient 资金不足
-  candle 新的单个K线数据
-  price 新的价格
-  signal:buy 买入信号
-  signal:sell 卖出信号
