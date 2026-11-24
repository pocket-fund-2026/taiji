// India-wide reference data shared by onboarding, the planner, wedding setup and Discover.
// Cities are grouped by state for the picker. Anyone can also type a city that is not listed.
export const POPULAR_CITIES = ['Delhi', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Chandigarh', 'Kochi'];
export const INDIA_CITIES: [string, string[]][] = [
  ['Andhra Pradesh', ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati']],
  ['Assam', ['Guwahati', 'Dibrugarh']],
  ['Bihar', ['Patna', 'Gaya']],
  ['Chandigarh', ['Chandigarh']],
  ['Chhattisgarh', ['Raipur', 'Bhilai']],
  ['Delhi NCR', ['Delhi', 'Gurugram', 'Noida', 'Ghaziabad', 'Faridabad']],
  ['Goa', ['Panaji', 'Margao']],
  ['Gujarat', ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar']],
  ['Haryana', ['Ambala', 'Karnal', 'Hisar']],
  ['Himachal Pradesh', ['Shimla', 'Manali']],
  ['Jammu & Kashmir', ['Srinagar', 'Jammu']],
  ['Jharkhand', ['Ranchi', 'Jamshedpur']],
  ['Karnataka', ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi']],
  ['Kerala', ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur']],
  ['Madhya Pradesh', ['Indore', 'Bhopal', 'Gwalior', 'Jabalpur']],
  ['Maharashtra', ['Mumbai', 'Pune', 'Nashik', 'Nagpur', 'Thane', 'Aurangabad', 'Kolhapur', 'Solapur']],
  ['Odisha', ['Bhubaneswar', 'Cuttack']],
  ['Punjab', ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala']],
  ['Rajasthan', ['Jaipur', 'Udaipur', 'Jodhpur', 'Jaisalmer', 'Kota', 'Ajmer']],
  ['Tamil Nadu', ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem']],
  ['Telangana', ['Hyderabad', 'Warangal']],
  ['Uttar Pradesh', ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Prayagraj', 'Meerut']],
  ['Uttarakhand', ['Dehradun', 'Haridwar']],
  ['West Bengal', ['Kolkata', 'Howrah', 'Siliguri', 'Durgapur']],
];
export const ALL_CITIES = Array.from(new Set(INDIA_CITIES.flatMap(([, c]) => c))).sort((a, b) => a.localeCompare(b));
// Ceremony plans exist for these traditions. The ceremony names are a starting point families edit.
export const COMMUNITIES = ['North Indian Hindu', 'South Indian', 'Tamil', 'Telugu', 'Malayali', 'Bengali', 'Gujarati', 'Marathi', 'Punjabi/Sikh', 'Sindhi', 'Assamese', 'Parsi', 'Muslim', 'Christian', 'Jain', 'Inter-faith'];
