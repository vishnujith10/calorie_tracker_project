import axios from "axios";
import Constants from "expo-constants";
import supabase from "../lib/supabase";

// -------------------- Edge Function URLs --------------------
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  Constants.expoConfig?.extra?.supabaseUrl ||
  "https://tkuyjtdycmmkvunurlxj.supabase.co";
const BASE_URL = supabaseUrl.replace(".supabase.co", ".functions.supabase.co");
const ANALYZE_FOOD_FUNCTION = `${BASE_URL}/analyze-food`;

// Edge function key (server-only) from env
const EDGE_KEY = Constants.expoConfig?.extra?.supabaseServiceRoleKey || null;

// -------------------- USER FOOD LOGS (SDK, RLS safe) --------------------

export const getFoodLogs = async (userId) => {
  try {
    if (!userId) throw new Error("userId is required");

    const { data, error } = await supabase
      .from("user_food_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Error getting food logs:", err);
    throw err;
  }
};

export const createFoodLog = async (foodLog) => {
  try {
    if (!foodLog?.user_id) throw new Error("user_id is required");

    const { data, error } = await supabase
      .from("user_food_logs")
      .insert([{ ...foodLog, created_at: new Date().toISOString() }])
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Error creating food log:", err);
    throw err;
  }
};

export const updateFoodLog = async (id, updates) => {
  try {
    if (!id) throw new Error("id is required");

    const { data, error } = await supabase
      .from("user_food_logs")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Error updating food log:", err);
    throw err;
  }
};

export const deleteFoodLog = async (id) => {
  try {
    if (!id) throw new Error("id is required");

    const { error } = await supabase
      .from("user_food_logs")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Error deleting food log:", err);
    throw err;
  }
};

// -------------------- SENSITIVE OPERATIONS (Edge Functions) --------------------

export const analyzeFood = async (text) => {
  try {
    const response = await axios.post(
      ANALYZE_FOOD_FUNCTION,
      { text },
      {
        headers: {
          Authorization: `Bearer ${EDGE_KEY}`, // secure key only for server/Edge
        },
      },
    );

    return response.data;
  } catch (err) {
    console.error("Error analyzing food:", err.response || err);
    throw err;
  }
};
