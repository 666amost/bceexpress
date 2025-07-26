import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseKey)

// Sample couriers to add
const sampleCouriers = [
  {
    email: "john@bceexpress.com",
    name: "John Doe",
    role: "courier",
  },
  {
    email: "jane@bceexpress.com",
    name: "Jane Smith",
    role: "courier",
  },
  {
    email: "mike@bceexpress.com",
    name: "Mike Johnson",
    role: "courier",
  },
]

// Function to add sample couriers
async function addSampleCouriers() {
  for (const courier of sampleCouriers) {
    // Check if courier already exists
    const { data: existingUser } = await supabase.from("users").select("*").eq("email", courier.email).single()

    if (!existingUser) {
      // Create auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: courier.email,
        password: "password123", // Default password
        email_confirm: true,
      })

      if (authError) {
        console.error(`Error creating auth user for ${courier.email}:`, authError)
        continue
      }

      // Add user to users table
      const { error: userError } = await supabase.from("users").insert([
        {
          id: authUser.user.id,
          email: courier.email,
          name: courier.name,
          role: courier.role,
        },
      ])

      if (userError) {
        console.error(`Error adding user record for ${courier.email}:`, userError)
        continue
      }

      console.warn(`Added courier: ${courier.name} (${courier.email})`)
    } else {
      console.warn(`Courier already exists: ${courier.email}`)
    }
  }

  console.warn("Sample couriers added successfully")
}

// Run the function
addSampleCouriers()
