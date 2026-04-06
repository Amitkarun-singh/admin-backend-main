import { Sequelize } from "sequelize";
import dotenv from "dotenv";
const path = process.cwd();
console.log(`${path}/config.env`);
dotenv.config({ path: `${path}/.env` });

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: "mysql",
    logging: false,
    connectionLimit: 10,
  },
);

console.log(
  "🔍 Sequelize username:",
  JSON.stringify(sequelize.config.username),
);

export default sequelize;
