const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

const resolveSocketPath = () => {
  const configuredSocketPath = process.env.MYSQL_SOCKET_PATH;
  if (!configuredSocketPath) {
    return null;
  }

  if (fs.existsSync(configuredSocketPath)) {
    return configuredSocketPath;
  }

  console.warn(`[SEQUELIZE] MYSQL_SOCKET_PATH was set but not found at ${configuredSocketPath}. Falling back to TCP host/port.`);
  return null;
};

const mysqlSocketPath = resolveSocketPath();

const isRecoverableAlterError = (error) => {
  const sqlError = error?.original || error?.parent || error;
  const message = [
    error?.message,
    sqlError?.message,
    sqlError?.sqlMessage,
  ].filter(Boolean).join(' ');

  return sqlError?.code === 'ER_CANT_DROP_FIELD_OR_KEY'
    || sqlError?.errno === 1091
    || message.includes("Can't DROP");
};

const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE || 'Sigmora_db',
  process.env.MYSQL_USER || 'root',
  process.env.MYSQL_PASSWORD || '',
  {
    host: mysqlSocketPath ? undefined : (process.env.MYSQL_HOST || 'localhost'),
    port: process.env.MYSQL_PORT || 3306,
    dialect: 'mysql',
    logging: false, // Set to true to see SQL queries
    dialectOptions: mysqlSocketPath
      ? { socketPath: mysqlSocketPath }
      : undefined,
    pool: {
      max: 20, // Increase pool size for massive seeding
      min: 0,
      acquire: 60000,
      idle: 10000
    }
  }
);

const connectSequelize = async ({ syncSchema = false, alter = false, allowAlterFallback = false } = {}) => {
  try {
    await sequelize.authenticate();
    console.log('[SEQUELIZE] MySQL Database connected successfully.');

    if (syncSchema) {
      try {
        await sequelize.sync({ alter });
        console.log(`[SEQUELIZE] MySQL schema synchronized${alter ? ' with alter' : ''}.`);
      } catch (error) {
        if (!alter || !allowAlterFallback || !isRecoverableAlterError(error)) {
          throw error;
        }

        console.warn('[SEQUELIZE] Schema alter failed due to a MySQL foreign-key drop issue. Retrying without alter so the server can continue.');
        await sequelize.sync();
        console.log('[SEQUELIZE] MySQL schema synchronized without alter after fallback.');
      }
    }
  } catch (error) {
    console.error('[SEQUELIZE] Unable to connect to the MySQL database:', error.message);
    throw error;
  }
};

module.exports = { sequelize, connectSequelize };
