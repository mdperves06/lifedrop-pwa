// Location hierarchy: Division → District → Area (upazila / thana).
// Coordinates are approximate area centroids used only for coarse radius matching.

type Area = [name: string, nameBn: string, lat: number, lng: number];
type District = { name: string; nameBn: string; areas: Area[] };
type Division = { name: string; nameBn: string; districts: District[] };

export const LOCATIONS: Division[] = [
  {
    name: "Dhaka",
    nameBn: "ঢাকা",
    districts: [
      {
        name: "Dhaka",
        nameBn: "ঢাকা",
        areas: [
          ["Dhanmondi", "ধানমন্ডি", 23.7465, 90.376],
          ["Mohammadpur", "মোহাম্মদপুর", 23.7662, 90.3589],
          ["Mirpur", "মিরপুর", 23.8223, 90.3654],
          ["Gulshan", "গুলশান", 23.7925, 90.4148],
          ["Banani", "বনানী", 23.794, 90.4043],
          ["Uttara", "উত্তরা", 23.8759, 90.3795],
          ["Motijheel", "মতিঝিল", 23.733, 90.4172],
          ["Shahbagh", "শাহবাগ", 23.7389, 90.3957],
          ["Tejgaon", "তেজগাঁও", 23.7639, 90.3925],
          ["Badda", "বাড্ডা", 23.7806, 90.4265],
          ["Rampura", "রামপুরা", 23.7613, 90.4214],
          ["Lalbagh", "লালবাগ", 23.7189, 90.3882],
          ["Jatrabari", "যাত্রাবাড়ী", 23.7104, 90.4349],
          ["Khilgaon", "খিলগাঁও", 23.7515, 90.4296],
          ["Mohakhali", "মহাখালী", 23.778, 90.405],
          ["Farmgate", "ফার্মগেট", 23.7577, 90.3895],
          ["Bashundhara", "বসুন্ধরা", 23.8193, 90.4526],
          ["Shyamoli", "শ্যামলী", 23.7743, 90.3653],
          ["Keraniganj", "কেরানীগঞ্জ", 23.6981, 90.3455],
          ["Savar", "সাভার", 23.8583, 90.2667],
        ],
      },
      { name: "Gazipur", nameBn: "গাজীপুর", areas: [["Gazipur Sadar", "গাজীপুর সদর", 23.9999, 90.4203], ["Tongi", "টঙ্গী", 23.8915, 90.4023]] },
      { name: "Narayanganj", nameBn: "নারায়ণগঞ্জ", areas: [["Narayanganj Sadar", "নারায়ণগঞ্জ সদর", 23.6238, 90.5]] },
    ],
  },
  {
    name: "Chattogram",
    nameBn: "চট্টগ্রাম",
    districts: [
      {
        name: "Chattogram",
        nameBn: "চট্টগ্রাম",
        areas: [
          ["Panchlaish", "পাঁচলাইশ", 22.36, 91.83],
          ["Kotwali", "কোতোয়ালী", 22.335, 91.835],
          ["Halishahar", "হালিশহর", 22.328, 91.781],
          ["Agrabad", "আগ্রাবাদ", 22.323, 91.81],
          ["Pahartali", "পাহাড়তলী", 22.37, 91.78],
        ],
      },
      { name: "Cox's Bazar", nameBn: "কক্সবাজার", areas: [["Cox's Bazar Sadar", "কক্সবাজার সদর", 21.4272, 92.0058]] },
    ],
  },
  {
    name: "Rajshahi",
    nameBn: "রাজশাহী",
    districts: [
      { name: "Rajshahi", nameBn: "রাজশাহী", areas: [["Boalia", "বোয়ালিয়া", 24.37, 88.6], ["Rajpara", "রাজপাড়া", 24.375, 88.58]] },
      { name: "Bogura", nameBn: "বগুড়া", areas: [["Bogura Sadar", "বগুড়া সদর", 24.8465, 89.3773]] },
    ],
  },
  {
    name: "Khulna",
    nameBn: "খুলনা",
    districts: [
      { name: "Khulna", nameBn: "খুলনা", areas: [["Khulna Sadar", "খুলনা সদর", 22.815, 89.565], ["Sonadanga", "সোনাডাঙ্গা", 22.82, 89.54]] },
      { name: "Jashore", nameBn: "যশোর", areas: [["Jashore Sadar", "যশোর সদর", 23.1664, 89.2081]] },
    ],
  },
  {
    name: "Barishal",
    nameBn: "বরিশাল",
    districts: [{ name: "Barishal", nameBn: "বরিশাল", areas: [["Barishal Sadar", "বরিশাল সদর", 22.701, 90.3535]] }],
  },
  {
    name: "Sylhet",
    nameBn: "সিলেট",
    districts: [
      {
        name: "Sylhet",
        nameBn: "সিলেট",
        areas: [
          ["Sylhet Sadar", "সিলেট সদর", 24.8949, 91.8687],
          ["South Surma", "দক্ষিণ সুরমা", 24.87, 91.88],
          ["Beanibazar", "বিয়ানীবাজার", 24.8167, 92.1583],
          ["Golapganj", "গোলাপগঞ্জ", 24.85, 92.0167],
        ],
      },
      { name: "Moulvibazar", nameBn: "মৌলভীবাজার", areas: [["Moulvibazar Sadar", "মৌলভীবাজার সদর", 24.4829, 91.7774], ["Sreemangal", "শ্রীমঙ্গল", 24.3065, 91.7296]] },
    ],
  },
  {
    name: "Rangpur",
    nameBn: "রংপুর",
    districts: [
      { name: "Rangpur", nameBn: "রংপুর", areas: [["Rangpur Sadar", "রংপুর সদর", 25.7439, 89.2752]] },
      { name: "Dinajpur", nameBn: "দিনাজপুর", areas: [["Dinajpur Sadar", "দিনাজপুর সদর", 25.6217, 88.6354]] },
    ],
  },
  {
    name: "Mymensingh",
    nameBn: "ময়মনসিংহ",
    districts: [{ name: "Mymensingh", nameBn: "ময়মনসিংহ", areas: [["Mymensingh Sadar", "ময়মনসিংহ সদর", 24.7471, 90.4203]] }],
  },
];
