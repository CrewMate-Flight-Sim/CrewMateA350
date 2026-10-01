import json
import re

def bump_version(version, increment_type):
    # Split version
    major, minor, patch = version.split('.')

    # bump version based on the specified type
    if increment_type == 'major':
        major = str(int(major) + 1)
        minor = '0'
        patch = '0'
    elif increment_type == 'feature':
        minor = str(int(minor) + 1)
        patch = '0'
    elif increment_type == 'fix':
        patch = str(int(patch) + 1)

    # Bumped version string
    new_version = f'{major}.{minor}.{patch}'
    return new_version

def update_json_files(new_version):
    # Bump version in package.json
    with open('../package.json', 'r') as f:
        package_json = json.load(f)
        package_json['version'] = new_version
    with open('../package.json', 'w') as f:
        json.dump(package_json, f, indent=2)
    print('[v_bumper] Version bumped in package.json')


def update_cargo_toml(new_version):
    # Read current content from Cargo.toml
    with open('../src-tauri/Cargo.toml', 'r') as f:
        cargo_content = f.read()

    # Bump version in Cargo.toml
    updated_cargo_content = re.sub(r'(\[package\][\s\S]*?version\s*=\s*")([\d.]+)(")', rf'\g<1>{new_version}\g<3>', cargo_content)

    # Write the modified content back to Cargo.toml
    with open('../src-tauri/Cargo.toml', 'w') as f:
        f.write(updated_cargo_content)

    print('[v_bumper] Version bumped in src-tauri/Cargo.toml')

def update_tauri_conf(new_version):
    # Bump version in tauri.conf.json
    with open('../src-tauri/tauri.conf.json', 'r') as f:
        tauri_conf = json.load(f)
        tauri_conf['version'] = new_version
    with open('../src-tauri/tauri.conf.json', 'w') as f:
        json.dump(tauri_conf, f, indent=2)
    print('[v_bumper] Version bumped in src-tauri/tauri.conf.json')

def main():
    # Read current version from package.json
    with open('../package.json', 'r') as f:
        package_json = json.load(f)
        current_version = package_json['version']
        print(f'[v_bumper] Current versionings: {current_version}')

    # Prompt for the increment type
    increment_type = input("major, feature or fix? ").strip().lower()

    # Bump version
    new_version = bump_version(current_version, increment_type)
    print(f'[v_bumper] New version: {new_version}')

    # Bump version in JSON files
    update_json_files(new_version)

    # Bump version in Cargo.toml
    update_cargo_toml(new_version)

    # Bump version in tauri.conf.json
    update_tauri_conf(new_version)

if __name__ == "__main__":
    main()