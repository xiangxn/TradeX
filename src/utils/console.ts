import log4js from 'log4js'

log4js.configure({
    appenders: {
        // 输出所有日志的文件
        allLogs: {
            type: 'file',
            filename: 'logs/all.log',
            maxLogSize: 10485760, // 10MB
            backups: 3,
            compress: true
        },
        // 输出 error 级别及以上日志的文件
        errorLogs: {
            type: 'file',
            filename: 'logs/error.log',
            maxLogSize: 10485760, // 10MB
            backups: 3,
            compress: true
        },
        // 过滤器：只允许 error 及以上级别的日志写入 errorLogs
        errorFilter: {
            type: 'logLevelFilter',
            appender: 'errorLogs',
            level: 'error'
        },
        out: {
            type: 'console'
        }
    },
    categories: {
        default: {
            appenders: ['allLogs', 'errorFilter', 'out'],
            level: 'debug' // 捕捉所有级别
        }
    }
});

const logger = log4js.getLogger()
const originalConsole = { ...console };
const isDebug = process.env.NODE_ENV !== "production"


console.error = (...args) => {
    logger.error(...args)
};

console.warn = (...args) => {
    logger.warn(...args)
};

console.info = (...args) => {
    logger.info(...args)
};

console.debug = (...args) => {
    if (isDebug)
        logger.debug(...args)
}

console.log = (...args) => {
    if (isDebug)
        logger.log(...args)
}