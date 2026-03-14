import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

const targetBarbers = [
  {
    firstName: "HASAN",
    lastName: "SAKAR",
    username: "HASAN",
    password: "HASAN1087",
    email: "istanbulsalon@saon.tr",
    phone: "+355 69 360 1662",
    branchLabel: "wilson",
    yearsOfExperience: 5,
    bio: "Professional barber specializing in modern haircuts and beard styling.",
  },
  {
    firstName: "DENIZ",
    lastName: "SAKAR",
    username: "DENIZ",
    password: "SAKAR22",
    email: "istanbulsalon@saon.tr",
    phone: "+355 69 986 7613",
    branchLabel: "wilson",
    yearsOfExperience: 4,
    bio: "Experienced barber focused on clean fades and beard grooming.",
  },
  {
    firstName: "SULEYMAN",
    lastName: "KANATLI",
    username: "SULEYMAN",
    password: "SULEYMAN2001",
    email: "istanbulsalon@saon.tr",
    phone: "+355 69 696 2560",
    branchLabel: "wilson",
    yearsOfExperience: 6,
    bio: "Skilled barber providing classic and modern haircut styles.",
  },
  {
    firstName: "AHMET",
    lastName: "AFSAL",
    username: "AHMET",
    password: "AFSAL8431",
    email: "istanbulsalon@saon.tr",
    phone: "+355 69 640 0403",
    branchLabel: "wilson",
    yearsOfExperience: 5,
    bio: "Dedicated barber known for precision cuts and styling.",
  },
  {
    firstName: "YUSUF",
    lastName: "BUCAK",
    username: "YUSUF",
    password: "BUCAK251",
    email: "istanbulsalon@saon.tr",
    phone: "+355 69 238 6552",
    branchLabel: "wilson",
    yearsOfExperience: 3,
    bio: "Friendly barber delivering quality grooming services.",
  },
  {
    firstName: "GUNAY",
    lastName: "HAMURCU",
    username: "GUNAY",
    password: "HAMURCU35233",
    email: "istanbulsalon@saon.tr",
    phone: "+355 69 298 9119",
    branchLabel: "wilson",
    yearsOfExperience: 7,
    bio: "Senior barber experienced in fades, beard trims, and styling.",
  },
  {
    firstName: "OKAN",
    lastName: "ALPASLAN",
    username: "OKAN ALPASLAN",
    password: "ASLAN231",
    email: "istanbulsalon@saon.tr",
    phone: "+355 69 606 8795",
    branchLabel: "kavaja",
    yearsOfExperience: 6,
    bio: "Professional barber delivering premium haircut services.",
  },
  {
    firstName: "ENGIN",
    lastName: "KAFAOGLU",
    username: "EBGIN KAFAOGLU",
    password: "ENGIN881",
    email: "istanbulsalon@saon.tr",
    phone: "+90 535 388 1287",
    branchLabel: "kavaja",
    yearsOfExperience: 5,
    bio: "Experienced barber focused on detailed haircuts and beard care.",
  },
  {
    firstName: "VOLKAN",
    lastName: "ALPASLAN",
    username: "VOLKAN ALPASLAN",
    password: "VOLKAN480",
    email: "istanbulsalon@saon.tr",
    phone: "+90 539 795 2263",
    branchLabel: "kavaja",
    yearsOfExperience: 4,
    bio: null,
  },
];

const toMatch = (val) => (val ?? "").toLowerCase();

const findBranchId = (items, label) => {
  const l = label.toLowerCase();
  let match = items.find((b) => toMatch(b.name).includes(l) || toMatch(b.location).includes(l));
  if (match) return match.id;
  if (l.includes("wilson")) {
    match = items.find((b) => toMatch(b.name) === "a");
    if (match) return match.id;
  }
  if (l.includes("kavaja")) {
    match = items.find((b) => toMatch(b.name) === "b");
    if (match) return match.id;
  }
  return null;
};

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const branchRes = await pool.query("select id, name, location from branches");
  const branchItems = branchRes.rows;
  const branchIdByLabel = {
    wilson: findBranchId(branchItems, "wilson"),
    kavaja: findBranchId(branchItems, "kavaja"),
  };

  const existingRes = await pool.query("select lower(username) as username, lower(email) as email from users");
  const existingUsernames = new Set(existingRes.rows.map((r) => toMatch(r.username)));
  const existingEmails = new Set(existingRes.rows.map((r) => toMatch(r.email)));

  const created = [];
  const skipped = [];

  for (const barber of targetBarbers) {
    const normalizedUsername = barber.username.trim().toLowerCase();
    const normalizedEmail = barber.email ? barber.email.trim().toLowerCase() : "";
    if (existingUsernames.has(normalizedUsername)) {
      skipped.push({ username: barber.username, reason: "username_exists" });
      continue;
    }
    if (normalizedEmail && existingEmails.has(normalizedEmail)) {
      skipped.push({ username: barber.username, reason: "email_exists" });
      continue;
    }

    const branchId = branchIdByLabel[barber.branchLabel] ?? null;
    const hashedPassword = await bcrypt.hash(barber.password, 10);

    try {
      await pool.query(
        `insert into users (
        username, google_id, password, auth_provider, role,
        first_name, last_name, phone, email, email_verified,
        loyalty_points, branch_id, years_of_experience, bio,
        photo_url, instagram_url, is_available, unavailable_hours,
        no_show_count, is_flagged_no_show, booking_credit_cents,
        admin_permissions, is_deleted
      ) values (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,
        $11,$12,$13,$14,
        $15,$16,$17,$18,
        $19,$20,$21,
        $22,$23
      )`,
        [
          normalizedUsername,
          null,
          hashedPassword,
          "local",
          "barber",
          barber.firstName.trim(),
          barber.lastName.trim(),
          barber.phone.trim(),
          barber.email.trim(),
          true,
          0,
          branchId,
          barber.yearsOfExperience,
          barber.bio ? barber.bio.trim() : null,
          null,
          null,
          true,
          "[]",
          0,
          false,
          0,
          "[]",
          false,
        ],
      );
      created.push(barber.username);
      existingUsernames.add(normalizedUsername);
      if (normalizedEmail) existingEmails.add(normalizedEmail);
    } catch (err) {
      skipped.push({ username: barber.username, reason: "insert_failed" });
    }
  }

  await pool.end();

  console.log(JSON.stringify({ created, skipped, branchIdByLabel }, null, 2));
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
