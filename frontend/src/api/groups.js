import axios from "./axios";

export const createGroup = (data) => axios.post("/groups", data);
export const getUserGroups = () => axios.get("/groups");
export const getGroupById = (groupId) => axios.get(`/groups/${groupId}`);
export const updateGroupInfo = (groupId, data) => axios.put(`/groups/${groupId}`, data);
export const addMembersToGroup = (groupId, memberIds) => 
  axios.post(`/groups/${groupId}/members`, { memberIds });
export const removeMemberFromGroup = (groupId, memberId) =>
  axios.delete(`/groups/${groupId}/members/${memberId}`);
export const makeAdmin = (groupId, memberId) =>
  axios.post(`/groups/${groupId}/members/${memberId}/admin`);
export const disbandGroup = (groupId) => axios.post(`/groups/${groupId}/disband`);
export const leaveGroup = (groupId) => axios.post(`/groups/${groupId}/leave`);
export const deleteGroup = (groupId) => axios.delete(`/groups/${groupId}`);
