require 'csv'
require 'fileutils'
require 'json'
require 'open-uri'
require 'open3'
require 'tempfile'

SOURCE_URL = 'https://www.post.japanpost.jp/zipcode/dl/utf/zip/utf_ken_all.zip'
OUTPUT_PATH = File.expand_path('../netlify/data/postal-suggest-data.json', __dir__)

def katakana_to_hiragana(text)
  text.to_s.tr('ァ-ヶ', 'ぁ-ゖ')
end

def normalize_kana(text)
  katakana_to_hiragana(text.to_s.strip)
end

def build_address(prefecture, city, town)
  [prefecture, city, town].map(&:strip).reject(&:empty?).join
end

def format_postal_code(postal_code)
  return postal_code unless postal_code.match?(/^\d{7}$/)

  "#{postal_code[0, 3]}-#{postal_code[3, 4]}"
end

def parse_csv_from_zip(zip_path)
  stdout, stderr, status = Open3.capture3('unzip', '-p', zip_path)
  raise "failed to unzip source: #{stderr}" unless status.success?

  CSV.parse(stdout, headers: false, encoding: 'UTF-8')
end

Tempfile.create(['japanpost-utf', '.zip']) do |file|
  URI.open(SOURCE_URL) do |remote|
    file.write(remote.read)
  end
  file.flush

  groups = Hash.new { |hash, key| hash[key] = [] }
  seen = {}

  parse_csv_from_zip(file.path).each do |row|
    postal_code = row[2].to_s.strip
    prefecture_kana = normalize_kana(row[3])
    city_kana = normalize_kana(row[4])
    town_kana = normalize_kana(row[5])
    prefecture = row[6].to_s.strip
    city = row[7].to_s.strip
    town = row[8].to_s.strip
    address = build_address(prefecture, city, town)
    address_kana = [prefecture_kana, city_kana, town_kana].reject(&:empty?).join

    next unless postal_code.match?(/^\d{7}$/)
    next if address.empty?

    dedupe_key = "#{postal_code}|#{address}"
    next if seen[dedupe_key]

    seen[dedupe_key] = true
    groups[postal_code[0, 4]] << [
      postal_code,
      format_postal_code(postal_code),
      address,
      address_kana
    ]
  end

  FileUtils.mkdir_p(File.dirname(OUTPUT_PATH))
  File.write(OUTPUT_PATH, JSON.generate(groups))
end
