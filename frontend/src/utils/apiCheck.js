// API connectivity check for production
export const checkApiConnectivity = async () => {
  const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001";
  
  try {
    console.log("🔗 Checking API connectivity to:", API_BASE);
    
    const response = await fetch(`${API_BASE}/api/health`, {
      method: 'GET',
      timeout: 10000
    });
    
    if (response.ok) {
      console.log("✅ API connection successful");
      return { success: true, url: API_BASE };
    } else {
      console.error("❌ API responded with error:", response.status);
      return { success: false, error: `HTTP ${response.status}`, url: API_BASE };
    }
  } catch (error) {
    console.error("❌ API connection failed:", error.message);
    return { success: false, error: error.message, url: API_BASE };
  }
};

export const displayApiStatus = (status) => {
  if (status.success) {
    console.log(`✅ Connected to: ${status.url}`);
  } else {
    console.warn(`⚠️ API Connection Issue:`);
    console.warn(`URL: ${status.url}`);
    console.warn(`Error: ${status.error}`);
    
    if (status.url.includes('localhost')) {
      console.warn(`💡 Tip: Make sure backend server is running`);
    } else {
      console.warn(`💡 Tip: Check network connection and backend deployment`);
    }
  }
};