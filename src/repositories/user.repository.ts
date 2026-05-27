import User from "../models/user.model.js";
import AdminRole from "../models/admin_role.model.js";
import AdminPermission from "../models/admin_permission.model.js";
import { generateAccessToken } from "../utils/jwt.util.js";

export class UserRepository {
  async findByUsername(username: string) {
    return await User.findOne({ where: { username } });
  }

  async findByEmail(email: string) {
    return await User.findOne({ where: { email } });
  }

  async findByPhoneNumber(phone_number: string) {
    return await User.findOne({ where: { phone_number } });
  }

  async findById(user_id: number | string) {
    return await User.findByPk(user_id);
  }

  async create(userData: any) {
    return await User.create(userData);
  }

  async update(user_id: number | string, updateData: any) {
    const user = await User.findByPk(user_id);
    if (!user) return null;
    return await user.update(updateData);
  }

  async findWithRoleAndPermissions(user_id: number | string) {
    return await User.findOne({
      where: { user_id },
      attributes: { exclude: ["password"] },
      include: [
        {
          model: AdminRole,
          as: "role",
          include: [
            {
              model: AdminPermission,
              as: "permissions",
              attributes: ["permission_key"],
            },
          ],
        },
      ],
    });
  }


  async getToken(userId: string){
     const user =  await User.findOne({ where: { user_id: userId } });
     return user.token
  }

  async updateToken(userId: string, token: string){
    return await User.update({ token }, { where: { user_id: userId } });
  }
}

export default new UserRepository();
