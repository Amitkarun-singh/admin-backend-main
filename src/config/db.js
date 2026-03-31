import { Sequelize } from "sequelize";
import dotEnv from "dotenv";
dotEnv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: "mysql",
    logging: false,
  },
);

console.log(
  "🔍 Sequelize username:",
  JSON.stringify(sequelize.config.username),
);

export default sequelize;
