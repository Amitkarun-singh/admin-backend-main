import sequelize from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import {classRepository} from "../repositories/class.repository.js";
import AdminClass from "../models/admin_class.model.js";
import AdminSection from "../models/admin_section.model.js";

interface BulkCreateClassesInput {
  classes: string[];
}

interface FilteredClassResult {
  class_id: number;
  class_name: string;
}

export class ClassService {

  async createClass(class_name: string): Promise<AdminClass> {
    if (!class_name) throw new ApiError(400, "Class name required");

    return classRepository.create(class_name);
  }

  async bulkCreateClasses({ classes }: BulkCreateClassesInput): Promise<AdminClass[]> {
    if (!classes || !Array.isArray(classes)) {
      throw new ApiError(400, "Classes array required");
    }

    const createdClasses: AdminClass[] = [];

    for (const className of classes) {
      const exists = await classRepository.findByName(className);
      if (exists) continue;

      const newClass = await classRepository.create(className);
      createdClasses.push(newClass);
    }

    return createdClasses;
  }

  async getAllClasses(school_id: number): Promise<FilteredClassResult[]> {
    const school = await classRepository.findSchoolById(school_id);
    if (!school) throw new ApiError(404, "School not found");

    const classCount = (school as any).class_count as number;
    const classes = await classRepository.findAll();

    return classes.filter((cls) => {
      const match = cls.class_name?.match(/\d+/);
      if (!match) return false;
      return parseInt(match[0]) <= classCount;
    }) as FilteredClassResult[];
  }

  async getClassById(id: number | string): Promise<AdminClass> {
    const classData = await classRepository.findById(id);
    if (!classData) throw new ApiError(404, "Class not found");
    return classData;
  }

  async updateClass(id: number | string, body: Partial<AdminClass>): Promise<AdminClass> {
    const classData = await classRepository.findById(id);
    if (!classData) throw new ApiError(404, "Class not found");
    return classRepository.update(classData, body);
  }

  async deleteClass(id: number | string): Promise<void> {
    const classData = await classRepository.findById(id);
    if (!classData) throw new ApiError(404, "Class not found");
    await classRepository.deleteWithRelated(id);
  }
}

export const classService = new ClassService();