import React, { useState, useEffect, useRef } from "react";
import userService, { UserDetail } from "../../services/userService";
import authService from "../../services/authService";
import {
  Users,
  UserPlus,
  Trash2,
  Edit2,
  Shield,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  MoreVertical,
  Loader2,
  AlertTriangle,
  X,
  Eye,
  EyeOff,
  ChevronDown,
} from "lucide-react";

export function UserManagementPage() {
  const [users, setUsers] = useState<UserDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState<
    Partial<UserDetail & { password?: string }>
  >({});
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<
    "role" | "status" | null
  >(null);
  const [deleteError, setDeleteError] = useState("");

  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        !roleDropdownRef.current?.contains(event.target as Node) &&
        !statusDropdownRef.current?.contains(event.target as Node)
      ) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const isAdmin = authService.isAdmin();
  const currentAuthUser = authService.getCurrentUser();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await userService.getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user?: UserDetail) => {
    if (user) {
      setCurrentUser(user);
      setIsEditing(true);
    } else {
      setCurrentUser({ role: "user", status: "active" });
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentUser({});
    setError("");
    setConfirmPassword("");
    setPasswordError("");
    setEmailError("");
    setConfirmPasswordError("");
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (isEditing) {
        await userService.updateUser({
          id: currentUser.id!,
          email: currentUser.email,
          role: currentUser.role,
          status: currentUser.status,
        });
      } else {
        if (!currentUser.password)
          throw new Error("Password is required for new users");

        if (emailError) {
          return;
        }

        if (passwordError) {
          return;
        }

        if (confirmPasswordError) {
          return;
        }

        await userService.createUser({
          email: currentUser.email!,
          password: currentUser.password,
          role: currentUser.role!,
        });
      }
      fetchUsers();
      handleCloseModal();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await userService.deleteUser(id);
      setDeleteConfirm(null);
      setDeleteError("");
      await fetchUsers();
    } catch (err: any) {
      console.error("Error deleting user:", err);
      setDeleteError(err.message || "Failed to delete user");
      setDeleteConfirm(null);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <Shield size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Access Denied
        </h2>
        <p className="text-gray-500">
          Only administrators can access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            User Management
          </h1>

          <p className="text-sm text-gray-500">
            Manage system access and roles
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all shadow-sm"
        >
          <UserPlus size={18} />
          <span>Create User</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-md flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <p className="text-gray-600 text-base font-medium mb-2">
              Total {users.length <= 1 ? "User" : "Users"}
            </p>
            <p className="text-2xl font-semibold text-gray-900">
              {users.length}
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-md flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Shield size={24} />
          </div>
          <div>
            <p className="text-gray-600 text-base font-medium mb-2">
              {users.filter((u) => u.role === "admin").length <= 1
                ? "Admin"
                : "Admins"}
            </p>
            <p className="text-2xl font-semibold text-gray-900">
              {users.filter((u) => u.role === "admin").length}
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-md flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-gray-600 text-base font-medium mb-2">
              {users.filter((u) => u.status === "active").length <= 1
                ? "Active Account"
                : "Active Accounts"}
            </p>
            <p className="text-2xl font-semibold text-gray-900">
              {users.filter((u) => u.status === "active").length}
            </p>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search by Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
            />
          </div>
        </div>

        <div className="p-6">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-900 border-r border-gray-200 text-center">
                      User
                    </th>

                    <th className="px-4 py-3 font-medium text-gray-900 border-r border-gray-200 text-center w-[120px]">
                      Role
                    </th>

                    <th className="px-4 py-3 font-medium text-gray-900 border-r border-gray-200 text-center w-[120px]">
                      Status
                    </th>

                    <th className="px-4 py-3 font-medium text-gray-900 border-r border-gray-200 text-center w-[150px]">
                      Created
                    </th>

                    <th className="px-4 py-3 font-medium text-gray-900 text-center w-[120px]">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((user, index) => (
                    <tr
                      key={`${user.id}-${index}`}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {/* USER */}
                      <td className="px-4 py-3 text-gray-600 border-r border-gray-200">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">
                            {user.email[0].toUpperCase()}
                          </div>

                          <div className="truncate">
                            <div className="font-semibold text-gray-900 truncate">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* ROLE */}
                      <td className="px-4 py-3 text-center border-r border-gray-200">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                            user.role === "admin"
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="px-4 py-3 text-center border-r border-gray-200">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                            user.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>

                      {/* CREATED */}
                      <td className="px-4 py-3 text-center text-gray-600 border-r border-gray-200">
                        {user.created_at.replace(/^\d{4}/, (match) =>
                          String(parseInt(match) + 543),
                        )}
                      </td>

                      {/* ACTION */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleOpenModal(user)}
                            disabled={user.email === "admin@gmail.com"}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition
disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          >
                            <Edit2 size={16} />
                          </button>

                          <button
                            onClick={() => setDeleteConfirm(user.id)}
                            disabled={
                              user.email === "admin@gmail.com" ||
                              user.id === currentAuthUser?.id
                            }
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition
disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                {isEditing ? "Edit User" : "Create User"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium flex items-center space-x-2">
                  <AlertTriangle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  required
                  disabled={isEditing}
                  value={currentUser.email || ""}
                  onChange={(e) => {
                    const email = e.target.value;
                    setCurrentUser({ ...currentUser, email });
                    const exists = users.some(
                      (u) =>
                        u.email.toLowerCase() === email.toLowerCase() &&
                        u.id !== currentUser.id,
                    );
                    if (exists) {
                      setEmailError("This email already exists.");
                    } else {
                      setEmailError("");
                    }
                  }}
                  className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm text-gray-900 ${
                    isEditing ? "cursor-not-allowed opacity-60 bg-gray-100" : ""
                  }`}
                  placeholder="name@email.com"
                />
                {emailError && (
                  <p className="text-xs text-red-500 mt-1">{emailError}</p>
                )}
              </div>

              {!isEditing && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={currentUser.password || ""}
                      onChange={(e) => {
                        const password = e.target.value;
                        setCurrentUser({
                          ...currentUser,
                          password,
                        });
                        if (password.length < 8) {
                          setPasswordError(
                            "Password must be at least 8 characters long.",
                          );
                        } else {
                          setPasswordError("");
                        }
                        setConfirmPasswordError("");
                      }}
                      className="w-full px-4 py-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm text-gray-900"
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onMouseDown={() => setShowPassword(true)}
                      onMouseUp={() => setShowPassword(false)}
                      onMouseLeave={() => setShowPassword(false)}
                      onTouchStart={() => setShowPassword(true)}
                      onTouchEnd={() => setShowPassword(false)}
                      className="absolute right-3 inset-y-0 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Eye size={20} />
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-xs text-red-500 mt-1">{passwordError}</p>
                  )}
                </div>
              )}

              {!isEditing && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordError("");
                        if (e.target.value !== currentUser.password) {
                          setConfirmPasswordError("Passwords must match.");
                        } else {
                          setConfirmPasswordError("");
                        }
                      }}
                      className="w-full px-4 py-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm text-gray-900"
                    />
                    <button
                      type="button"
                      onMouseDown={() => setShowConfirmPassword(true)}
                      onMouseUp={() => setShowConfirmPassword(false)}
                      onMouseLeave={() => setShowConfirmPassword(false)}
                      onTouchStart={() => setShowConfirmPassword(true)}
                      onTouchEnd={() => setShowConfirmPassword(false)}
                      className="absolute right-3 inset-y-0 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Eye size={20} />
                    </button>
                  </div>
                  {confirmPasswordError && (
                    <p className="text-xs text-red-500 mt-1">
                      {confirmPasswordError}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <div className="relative" ref={roleDropdownRef}>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveDropdown(
                          activeDropdown === "role" ? null : "role",
                        )
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 flex items-center justify-between hover:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 text-sm"
                    >
                      <span className="capitalize font-normal">
                        {currentUser.role || "user"}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`text-gray-500 transition-transform duration-200 ${
                          activeDropdown === "role" ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {activeDropdown === "role" && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100">
                        <div className="p-1">
                          <div
                            onClick={() => {
                              setCurrentUser({ ...currentUser, role: "user" });
                              setActiveDropdown(null);
                            }}
                            className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            User
                          </div>
                          <div
                            onClick={() => {
                              setCurrentUser({ ...currentUser, role: "admin" });
                              setActiveDropdown(null);
                            }}
                            className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            Admin
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {isEditing && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <div className="relative" ref={statusDropdownRef}>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveDropdown(
                            activeDropdown === "status" ? null : "status",
                          )
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 flex items-center justify-between hover:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 text-sm"
                      >
                        <span className="capitalize font-normal">
                          {currentUser.status || "active"}
                        </span>
                        <ChevronDown
                          size={16}
                          className={`text-gray-500 transition-transform duration-200 ${
                            activeDropdown === "status" ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {activeDropdown === "status" && (
                        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100">
                          <div className="p-1">
                            <div
                              onClick={() => {
                                setCurrentUser({
                                  ...currentUser,
                                  status: "active",
                                });
                                setActiveDropdown(null);
                              }}
                              className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                              Active
                            </div>
                            <div
                              onClick={() => {
                                setCurrentUser({
                                  ...currentUser,
                                  status: "suspended",
                                });
                                setActiveDropdown(null);
                              }}
                              className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                              Suspended
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all shadow-sm"
                >
                  {isEditing ? "Update User" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-red-600 mb-4">
              <AlertTriangle size={24} />
              <h2 className="text-xl font-bold">Delete User</h2>
            </div>
            <div className="text-gray-600 mb-6 space-y-1">
              <p>การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
              <p>ผู้ใช้งานจะไม่สามารถเข้าสู่ระบบได้อีกต่อไป</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUser(deleteConfirm)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
