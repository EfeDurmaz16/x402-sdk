local socket = require("socket")

local function json_string(value)
  return '"' .. tostring(value):gsub("\\", "\\\\"):gsub('"', '\\"') .. '"'
end

local function json_object(fields)
  local parts = {}
  for _, field in ipairs(fields) do
    local key = field[1]
    local value = field[2]
    if type(value) == "boolean" then
      table.insert(parts, json_string(key) .. ":" .. tostring(value))
    elseif type(value) == "number" then
      table.insert(parts, json_string(key) .. ":" .. tostring(value))
    elseif type(value) == "table" then
      local items = {}
      for _, item in ipairs(value) do
        table.insert(items, json_string(item))
      end
      table.insert(parts, json_string(key) .. ":[" .. table.concat(items, ",") .. "]")
    else
      table.insert(parts, json_string(key) .. ":" .. json_string(value))
    end
  end
  return "{" .. table.concat(parts, ",") .. "}"
end

local server = assert(socket.bind("127.0.0.1", 0))
local _, port = server:getsockname()

print(json_object({
  { "type", "ready" },
  { "implementation", "lua" },
  { "role", "server" },
  { "port", port },
  { "capabilities", { "exact" } }
}))
io.stdout:flush()

while true do
  local client = server:accept()
  if client then
    local request_line = client:receive("*l") or ""
    local path = request_line:match("^%u+%s+([^%s]+)%s+HTTP/%d%.%d$") or "/"
    while true do
      local line = client:receive("*l")
      if not line or line == "" then
        break
      end
    end

    local status = path == "/health" and 200 or 501
    local reason = status == 200 and "OK" or "Not Implemented"
    local body = path == "/health"
      and json_object({ { "ok", true } })
      or json_object({
        { "ok", false },
        { "paid", false },
        { "error", "lua_exact_server_not_implemented" }
      })

    client:send(
      "HTTP/1.1 " .. status .. " " .. reason .. "\r\n" ..
      "content-type: application/json\r\n" ..
      "content-length: " .. #body .. "\r\n" ..
      "connection: close\r\n\r\n" ..
      body
    )
    client:close()
  end
end
