import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

interface UserStreakAttributes {
  id: bigint;
  user_id: bigint;
  last_active_date?: string | null;
  current_streak: number;
  longest_streak: number;
}

interface UserStreakCreationAttributes
  extends Optional<UserStreakAttributes, "id"> {}

class UserStreak
  extends Model<UserStreakAttributes, UserStreakCreationAttributes>
  implements UserStreakAttributes
{
  public id!: bigint;
  public user_id!: bigint;
  public last_active_date?: string | null;
  public current_streak!: number;
  public longest_streak!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

UserStreak.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.BIGINT, allowNull: false, unique: true },
    last_active_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      defaultValue: null,
    },
    current_streak: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    longest_streak: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    tableName: "user_streaks",
    underscored: true,
    timestamps: true,
  }
);

export default UserStreak;