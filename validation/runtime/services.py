"""Optional local test services. Never installs packages or touches existing clusters."""
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time

root = Path(__file__).resolve().parents[2]
mode, directory = sys.argv[1], Path(sys.argv[2]).resolve()
assert directory.is_relative_to(root / 'output') and directory != root / 'output'

def run(args, env=None):
    result = subprocess.run(args, env=env, capture_output=True, text=True, timeout=30)
    if result.returncode:
        with (directory / 'service-error.log').open('a') as log:
            log.write(result.stdout + result.stderr)
    result.check_returncode()
    return result.stdout.strip()

def environment(binary):
    env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
    # Debian binary packages extracted under an isolated prefix.
    libraries = binary.parents[3] / 'lib/x86_64-linux-gnu'
    env['LD_LIBRARY_PATH'] = str(libraries)
    return env

def stop():
    config = json.loads((directory / 'services.json').read_text())
    binary = Path(config['postgresBin'])
    data = Path(config['dataDirectory']).resolve()
    temporary = data.parent
    assert temporary.parent == Path(tempfile.gettempdir()).resolve()
    assert temporary.name.startswith('commerce-validation-' + directory.name + '-')
    errors = []
    if (data / 'postmaster.pid').exists():
        try:
            run([str(binary / 'pg_ctl'), '-D', str(data), '-m', 'fast', '-w', 'stop'], environment(binary))
        except Exception as error:
            errors.append(type(error).__name__ + ': PostgreSQL stop failed')
    env = dict(os.environ, REDISCLI_AUTH=config['password'])
    try:
        run(['redis-cli', '-h', '127.0.0.1', '-p', str(config['redisPort']), 'shutdown', 'nosave'], env)
    except subprocess.CalledProcessError:
        # A failed startup has no Redis to stop; a live listener is an error.
        with socket.socket() as probe:
            if probe.connect_ex(('127.0.0.1', config['redisPort'])) == 0:
                errors.append('Redis stop failed')
    assert not errors, errors
    for port in [config['postgresPort'], config['redisPort']]:
        with socket.socket() as probe:
            assert probe.connect_ex(('127.0.0.1', port)) != 0, 'Test service still listening'
    if temporary.exists():
        assert not (data / 'postmaster.pid').exists()
        shutil.rmtree(temporary)
    (directory / 'cleanup.json').write_text(json.dumps({'stopped': True, 'portsClosed': True, 'temporaryClusterRemoved': True}))
    print(json.dumps({'stopped': True}))

if mode == 'stop':
    stop()
elif mode == 'start':
    binary = Path(sys.argv[3]).resolve()
    assert (binary / 'postgres').is_file()
    (root / 'output').mkdir(exist_ok=True)
    directory.mkdir()  # Refuse an existing output/cluster.
    password = secrets.token_hex(24)
    ports = []
    for _ in range(2):
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            ports.append(probe.getsockname()[1])
    assert ports[0] != ports[1]
    # NTFS mounts do not enforce PostgreSQL's required POSIX data permissions.
    temporary = Path(tempfile.mkdtemp(prefix='commerce-validation-' + directory.name + '-'))
    data = temporary / 'data'
    config = {'postgresBin': str(binary), 'dataDirectory': str(data), 'postgresPort': ports[0], 'redisPort': ports[1], 'password': password}
    (directory / 'services.json').write_text(json.dumps(config))
    (directory / 'services.json').chmod(0o600)
    try:
        (directory / 'password').write_text(password)
        (directory / 'password').chmod(0o600)
        env = environment(binary)
        run([str(binary / 'initdb'), '-D', str(data), '-U', 'commerce', '--pwfile', str(directory / 'password'), '--auth', 'scram-sha-256', '--no-locale', '-E', 'UTF8'], env)
        run([str(binary / 'pg_ctl'), '-D', str(data), '-l', str(directory / 'postgres.log'), '-w', 'start', '-o', "-h 127.0.0.1 -p " + str(ports[0]) + " -k '' -c cluster_name=commerce_rule_validation"], env)
        env['PGPASSWORD'] = password
        run([str(binary / 'createdb'), '-h', '127.0.0.1', '-p', str(ports[0]), '-U', 'commerce', 'commerce_validation'], env)
        redis_config = directory / 'redis.conf'
        redis_config.write_text(f'bind 127.0.0.1\nprotected-mode yes\nport {ports[1]}\nrequirepass {password}\nsave ""\nappendonly no\ndaemonize yes\npidfile {directory}/redis.pid\nlogfile {directory}/redis.log\ndir {directory}\n')
        redis_config.chmod(0o600)
        run(['redis-server', str(redis_config)])
        env['REDISCLI_AUTH'] = password
        for attempt in range(30):
            try:
                assert run(['redis-cli', '-h', '127.0.0.1', '-p', str(ports[1]), 'ping'], env) == 'PONG'
                break
            except subprocess.CalledProcessError:
                time.sleep(0.1)
        else:
            raise RuntimeError('Redis did not become ready')
        versions = {'postgres': run([str(binary / 'postgres'), '--version'], env), 'redis': run(['redis-server', '--version'])}
        (directory / 'versions.json').write_text(json.dumps(versions, indent=2))
        print(json.dumps({'ready': True}))
    except Exception:
        stop()
        raise
else:
    raise ValueError('Expected start or stop')
