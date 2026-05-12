import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegisterService } from '../src/services/register.service.js';
import authService from '../src/services/auth.service.js';
import userRepository from '../src/repositories/user.repository.js';
import roleRepository from '../src/repositories/role.repository.js';
import schoolRepository from '../src/repositories/school.repository.js';
import profileRepository from '../src/repositories/profile.repository.js';
import classRepository from '../src/repositories/class.repository.js';
import bcrypt from 'bcrypt';
import { ValidationError } from '../src/error/subError.js';

vi.mock('../src/services/auth.service.js', () => ({
  default: {
    verifyIdToken: vi.fn(),
    loginWithUserId: vi.fn(),
  }
}));

vi.mock('../src/repositories/user.repository.js', () => ({
  default: {
    findByPhoneNumber: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
  }
}));

vi.mock('../src/repositories/role.repository.js', () => ({
  default: {
    findByName: vi.fn(),
  }
}));

vi.mock('../src/repositories/school.repository.js', () => ({
  default: {
    findActiveCbseSchool: vi.fn(),
    incrementCount: vi.fn(),
  }
}));

vi.mock('../src/repositories/profile.repository.js', () => ({
  default: {
    createTeacherProfile: vi.fn(),
    createTeacherClassSectionSubject: vi.fn(),
    createStudentProfile: vi.fn(),
    createStudentClassSection: vi.fn(),
  }
}));

vi.mock('../src/repositories/class.repository.js', () => ({
  default: {
    findByNames: vi.fn(),
  }
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
  }
}));


interface ExpectedValidationError {
  extra: {
    errors: unknown[];
  };
}

describe('RegisterService', () => {
  let registerService: RegisterService;

  beforeEach(() => {
    vi.clearAllMocks();
    registerService = new RegisterService();
  });

  describe('register', () => {
    const validStudentData = {
      role: 'STUDENT',
      full_name: 'John Doe',
      password: 'password123',
      phone_number: '1234567890',
      email: 'john@example.com',
      board: 'CBSE',
      idToken: 'valid-token',
      class: '10',
      self_register: true
    };

    const validTeacherData = {
      role: 'TEACHER',
      full_name: 'Jane Smith',
      password: 'password123',
      phone_number: '0987654321',
      email: 'jane@example.com',
      board: 'CBSE',
      idToken: 'valid-token',
      class: '9, 10',
      self_register: true
    };

    it('should successfully register a student', async () => {
      // Setup mocks
      vi.mocked(authService.verifyIdToken).mockResolvedValue({} as never);
      vi.mocked(userRepository.findByPhoneNumber).mockResolvedValue(null as never);
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null as never);
      vi.mocked(roleRepository.findByName).mockResolvedValue({ role_id: 1 } as never);
      vi.mocked(schoolRepository.findActiveCbseSchool).mockResolvedValue({ school_id: 1 } as never);
      vi.mocked(classRepository.findByNames).mockResolvedValue([{ class_name: 'grade10', class_id: 10 }] as never);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
      vi.mocked(userRepository.create).mockResolvedValue({ user_id: 100 } as never);
      vi.mocked(profileRepository.createStudentProfile).mockResolvedValue({ student_id: 200 } as never);
      vi.mocked(authService.loginWithUserId).mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' } as never);

      const result = await registerService.register(validStudentData);

      expect(authService.verifyIdToken).toHaveBeenCalledWith('valid-token');
      expect(userRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        full_name: 'John Doe',
        role_id: 1,
        school_id: 1,
        status: 'Active'
      }));
      expect(profileRepository.createStudentProfile).toHaveBeenCalled();
      expect(profileRepository.createStudentClassSection).toHaveBeenCalled();
      expect(schoolRepository.incrementCount).toHaveBeenCalledWith(1, 'student_count');
      expect(authService.loginWithUserId).toHaveBeenCalledWith(100);
      expect(result).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
    });

    it('should successfully register a teacher', async () => {
      vi.mocked(authService.verifyIdToken).mockResolvedValue({} as never);
      vi.mocked(userRepository.findByPhoneNumber).mockResolvedValue(null as never);
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null as never);
      vi.mocked(roleRepository.findByName).mockResolvedValue({ role_id: 2 } as never);
      vi.mocked(schoolRepository.findActiveCbseSchool).mockResolvedValue({ school_id: 1 } as never);
      vi.mocked(classRepository.findByNames).mockResolvedValue([
        { class_name: 'grade 9', class_id: 9 },
        { class_name: 'grade 10', class_id: 10 }
      ] as never);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
      vi.mocked(userRepository.create).mockResolvedValue({ user_id: 101 } as never);
      vi.mocked(profileRepository.createTeacherProfile).mockResolvedValue({ teacher_id: 201 } as never);
      vi.mocked(authService.loginWithUserId).mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' } as never);

      const result = await registerService.register(validTeacherData);

      expect(userRepository.create).toHaveBeenCalled();
      expect(profileRepository.createTeacherProfile).toHaveBeenCalled();
      expect(profileRepository.createTeacherClassSectionSubject).toHaveBeenCalledTimes(2);
      expect(schoolRepository.incrementCount).toHaveBeenCalledWith(1, 'teacher_count');
    });

    it('should throw ValidationError if board is not CBSE', async () => {
      vi.mocked(authService.verifyIdToken).mockResolvedValue({} as never);
      
      try {
        await registerService.register({ ...validStudentData, board: 'ICSE' });
        expect.fail('Should throw error');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ExpectedValidationError).extra.errors).toContainEqual(expect.objectContaining({ field: 'board' }));
      }
    });

    it('should throw ValidationError if phone number already exists', async () => {
      vi.mocked(authService.verifyIdToken).mockResolvedValue({} as never);
      vi.mocked(userRepository.findByPhoneNumber).mockResolvedValue({ id: 1 } as never);
      
      try {
        await registerService.register(validStudentData);
        expect.fail('Should throw error');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ExpectedValidationError).extra.errors).toContainEqual(expect.objectContaining({ field: 'phone_number' }));
      }
    });

    it('should throw ValidationError if email already exists', async () => {
      vi.mocked(authService.verifyIdToken).mockResolvedValue({} as never);
      vi.mocked(userRepository.findByPhoneNumber).mockResolvedValue(null as never);
      vi.mocked(userRepository.findByEmail).mockResolvedValue({ id: 1 } as never);
      
      try {
        await registerService.register(validStudentData);
        expect.fail('Should throw error');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ExpectedValidationError).extra.errors).toContainEqual(expect.objectContaining({ field: 'email' }));
      }
    });

    it('should throw ValidationError if class mapping fails (missing classes)', async () => {
      vi.mocked(authService.verifyIdToken).mockResolvedValue({} as never);
      vi.mocked(userRepository.findByPhoneNumber).mockResolvedValue(null as never);
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null as never);
      vi.mocked(roleRepository.findByName).mockResolvedValue({ role_id: 1 } as never);
      vi.mocked(schoolRepository.findActiveCbseSchool).mockResolvedValue({ school_id: 1 } as never);
      vi.mocked(classRepository.findByNames).mockResolvedValue([
        { class_name: 'grade 9', class_id: 9 }
      ] as never);

      try {
        await registerService.register({ ...validTeacherData, class: '9, 10' });
        expect.fail('Should throw error');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ExpectedValidationError).extra.errors).toContainEqual(expect.objectContaining({ field: 'class' }));
      }
    });
  });
});
