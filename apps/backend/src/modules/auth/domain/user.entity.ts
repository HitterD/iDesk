export enum UserRole {
  MANAGER = 'MANAGER',
  TECHNICIAN = 'TECHNICIAN',
}

export class User {
  id: string;
  email: string;
  password?: string; // Optional because it might not be loaded in all contexts
  fullName: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: Partial<User>) {
    Object.assign(this, props);
  }
}
