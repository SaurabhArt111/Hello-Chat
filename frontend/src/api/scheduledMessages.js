import axios from "./axios";

export const scheduleMessage = (data) => axios.post("/scheduled-messages", data);
export const getScheduledMessages = () => axios.get("/scheduled-messages");
export const cancelScheduledMessage = (scheduledMessageId) => 
  axios.delete(`/scheduled-messages/${scheduledMessageId}`);
