import bcrypt from "bcrypt";
import sequelize from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { parentRepository } from "../repositories/parent.repository.js";
import ParentProfile from "../models/parent_profile.model.js";
import { fetchCurriculumMapsSafe, enrichClassSection } from "../utils/curriculumEnrich.js";

const VALID_RELATIONS = ["father", "mother", "guardian"];

interface CreateParentInput {
  school_id: number | bigint;
  username: string;
  password: string;
  phone_number?: string;
  email?: string;
  full_name?: string;
  relation?: string;
}

interface UpdateParentInput {
  user_id?: any;
  school_id?: any;
  relation?: string;
  [key: string]: any;
}

export class ParentService {

  async createParent(input: CreateParentInput): Promise<ParentProfile> {
    const { school_id, username, password, phone_number, email, full_name, relation } = input;

    if (!username || !password)
      throw new ApiError(400, "Required fields missing: username, password");

    if (relation && !VALID_RELATIONS.includes(relation))
      throw new ApiError(400, `Invalid relation. Must be one of: ${VALID_RELATIONS.join(", ")}`);

    const transaction = await sequelize.transaction();

    try {
      const parentRole = await parentRepository.findRoleByName("PARENT", transaction);
      if (!parentRole) throw new ApiError(400, "Parent role not found");

      const hashed = await bcrypt.hash(password, 10);

      const parentUser = await parentRepository.createUser({
        username, full_name: full_name || null,
        password: hashed, phone_number: phone_number || null,
        email: email || null, role_id: parentRole.role_id,
        school_id, status: "Active", is_password_reset_required: true,
      }, transaction);

      const parent = await parentRepository.createParentProfile({
        user_id: parentUser.user_id, school_id,
        relation: relation || null,
      }, transaction);

      await transaction.commit();
      return parent;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getAllParents(school_id: number | bigint): Promise<ParentProfile[]> {
    const parents = await parentRepository.findAllParents(school_id);
    return this.enrichParents(parents as any[]) as any;
  }

  async getParentById(id: number | string | bigint): Promise<ParentProfile> {
    const parent = await parentRepository.findParentById(id);
    if (!parent) throw new ApiError(404, "Parent not found");
    const [enriched] = await this.enrichParents([parent as any]);
    return enriched as unknown as ParentProfile;
  }

  async getParentProfile(id: number | string | bigint): Promise<ParentProfile> {
    const parent = await parentRepository.findParentProfile(id);
    if (!parent) throw new ApiError(404, "Parent not found");
    const [enriched] = await this.enrichParents([parent as any]);
    return enriched as unknown as ParentProfile;
  }

  /**
   * Enriches all children (students) of each parent with class_name and
   * section_name resolved via the curriculum microservice.
   */
  private async enrichParents(parents: any[]): Promise<any[]> {
    if (!parents.length) return parents;
    const maps = await fetchCurriculumMapsSafe();
    return parents.map((parent) => {
      const json = typeof parent.toJSON === "function" ? parent.toJSON() : { ...parent };
      if (Array.isArray(json.students)) {
        json.students = json.students.map((student: any) => {
          if (student.classSection) {
            enrichClassSection(student.classSection, maps);
          }
          return student;
        });
      }
      return json;
    });
  }

  async updateParent(id: number | string | bigint, body: UpdateParentInput): Promise<ParentProfile> {
    const parent = await parentRepository.findParentById(id);
    if (!parent) throw new ApiError(404, "Parent not found");

    const { user_id, school_id, full_name, phone_number, email, ...profileUpdates } = body;

    if (profileUpdates.relation && !VALID_RELATIONS.includes(profileUpdates.relation))
      throw new ApiError(400, `Invalid relation. Must be one of: ${VALID_RELATIONS.join(", ")}`);

    // Update ParentProfile fields (parent_name, relation, …)
    await parentRepository.updateParent(parent, profileUpdates);

    // Update linked User fields if any were provided
    const userFields: Record<string, any> = {};
    if (full_name  !== undefined) userFields.full_name   = full_name;
    if (phone_number !== undefined) userFields.phone_number = phone_number;
    if (email       !== undefined) userFields.email        = email;
    if (Object.keys(userFields).length > 0) {
      const parentUserId = (parent as any).user_id;
      await parentRepository.updateUserById(parentUserId, userFields);
    }

    // Return freshly fetched parent so caller gets updated data
    return this.getParentById(id);
  }

  async deleteParent(id: number | string | bigint): Promise<void> {
    const parent = await parentRepository.findParentById(id);
    if (!parent) throw new ApiError(404, "Parent not found");

    const user_id = (parent as any).user_id;
    await parentRepository.deleteParentWithRelated(id, user_id);
  }
}

export const parentService = new ParentService();